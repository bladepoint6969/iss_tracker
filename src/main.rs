#[macro_use]
extern crate rocket;
use chrono::{DateTime, Utc};
use clap::Parser;
use reqwest::{Client, StatusCode};
use rocket::State;
use rocket::fs::FileServer;
use rocket::serde::{Serialize, json::Json};
use serde::Deserialize;
use std::collections::VecDeque;
use std::sync::{Arc, OnceLock, RwLock};
use std::time::Duration;
use tokio::time;

#[derive(Debug, Clone, Copy, Parser)]
#[command()]
struct Cli {
    #[arg(short, long, default_value_t = 15_000)]
    /// How many ISS positions to keep stored
    max_positions: usize,
    #[arg(short, long, default_value_t = 2)]
    /// The interval between ISS position checks
    poll_interval: u64,
    #[arg(short, long, default_value_t = 3)]
    /// How long to wait before timing out a position check
    timeout: u64,
}

#[derive(Debug, Clone, Serialize)]
struct IssPosition {
    timestamp: i64,
    datetime: String,
    latitude: f64,
    longitude: f64,
}

struct AppState {
    positions: RwLock<VecDeque<IssPosition>>,
}

#[derive(Serialize)]
struct PositionsResponse {
    count: usize,
    last_update: Option<String>,
    positions: Vec<IssPosition>,
}

#[derive(Serialize)]
struct LatestResponse {
    last_update: Option<String>,
    position: Option<IssPosition>,
}

#[derive(Serialize)]
struct StatusResponse {
    positions_stored: usize,
    max_positions: usize,
    update_interval: u64,
    last_update: Option<String>,
}

static CONFIG: OnceLock<Cli> = OnceLock::new();
const USER_AGENT: &str = concat!(env!("CARGO_PKG_NAME"), "/", env!("CARGO_PKG_VERSION"));

#[get("/api/positions")]
async fn get_positions(state: &State<Arc<AppState>>) -> Json<PositionsResponse> {
    let positions: Vec<IssPosition> = {
        let positions_lock = state.positions.read().unwrap();
        positions_lock.iter().cloned().collect()
    };
    let count = positions.len();
    let last_update = positions.last().map(|p| p.datetime.clone());

    Json(PositionsResponse {
        count,
        last_update,
        positions,
    })
}

#[get("/api/latest")]
async fn get_latest(state: &State<Arc<AppState>>) -> Json<LatestResponse> {
    let latest = {
        let positions_lock = state.positions.read().unwrap();
        positions_lock.back().cloned()
    };
    let last_update = latest.as_ref().map(|p| p.datetime.clone());

    Json(LatestResponse {
        last_update,
        position: latest,
    })
}

#[get("/api/status")]
async fn get_status(state: &State<Arc<AppState>>) -> Json<StatusResponse> {
    let (positions_stored, last_update) = {
        let positions_lock = state.positions.read().unwrap();
        (
            positions_lock.len(),
            positions_lock.back().map(|p| p.datetime.clone()),
        )
    };

    let config = CONFIG.wait();

    Json(StatusResponse {
        positions_stored,
        max_positions: config.max_positions,
        update_interval: config.poll_interval,
        last_update,
    })
}

// Structs for deserializing the Open Notify API response
#[derive(Debug, Deserialize)]
struct IssApiPosition {
    latitude: String,
    longitude: String,
}

#[derive(Debug, Deserialize)]
struct IssApiResponse {
    message: String,
    timestamp: i64,
    iss_position: IssApiPosition,
}

async fn fetch_iss_position(client: &Client) -> Option<IssPosition> {
    match client
        .get("http://api.open-notify.org/iss-now.json")
        .send()
        .await
    {
        Ok(response) => {
            if response.status() != StatusCode::OK {
                let resp_text = response.text().await;
                println!("Error response from API: {resp_text:?}");
                return None;
            }
            match response.json::<IssApiResponse>().await {
                Ok(data) => {
                    if data.message == "success" {
                        // Parse string coordinates to f64, returning None if parsing fails
                        let latitude = data.iss_position.latitude.parse::<f64>().ok()?;
                        let longitude = data.iss_position.longitude.parse::<f64>().ok()?;

                        // Convert Unix timestamp to RFC3339 format
                        let datetime = DateTime::<Utc>::from_timestamp(data.timestamp, 0)
                            .unwrap_or_else(Utc::now)
                            .to_rfc3339();

                        let position = IssPosition {
                            timestamp: data.timestamp,
                            datetime,
                            latitude,
                            longitude,
                        };

                        println!(
                            "Position at {}: {}, {}",
                            position.datetime, position.latitude, position.longitude
                        );
                        return Some(position);
                    }
                    println!("API error: message not 'success'");
                    None
                }
                Err(e) => {
                    println!("Error parsing response: {}", e);
                    None
                }
            }
        }
        Err(e) => {
            println!("Error fetching ISS position: {}", e);
            None
        }
    }
}

async fn tracking_task(state: Arc<AppState>) {
    println!("ISS position tracking task started");
    let config = CONFIG.wait();
    let timeout = Duration::from_secs(config.timeout);
    let sleep_duration = Duration::from_secs(config.poll_interval);
    let client = Client::builder()
        .user_agent(USER_AGENT)
        .timeout(timeout)
        .build()
        .expect("Build Client");

    loop {
        if let Some(position) = fetch_iss_position(&client).await {
            // Minimize lock duration by using a scoped block
            {
                let mut positions = state.positions.write().unwrap();
                positions.push_back(position);

                // Maintain circular buffer of MAX_POSITIONS
                while positions.len() > config.max_positions {
                    positions.pop_front();
                }
            } // Lock is automatically released here
        }

        time::sleep(sleep_duration).await;
    }
}

#[launch]
async fn rocket() -> _ {
    let args = Cli::parse();
    CONFIG.get_or_init(|| args);
    let app_state = Arc::new(AppState {
        positions: RwLock::new(VecDeque::with_capacity(args.max_positions)),
    });

    // Launch background task for position tracking
    let state_clone = Arc::clone(&app_state);
    tokio::spawn(async move {
        tracking_task(state_clone).await;
    });

    println!(
        "ISS Tracker starting with {} position history",
        args.max_positions
    );
    println!("Server will continue tracking ISS positions in the background");
    println!("Access the web interface at http://localhost:8000");

    rocket::build()
        .manage(app_state)
        .mount("/", routes![get_positions, get_latest, get_status])
        .mount("/", FileServer::from("static"))
}
