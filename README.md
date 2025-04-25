# ISS Tracker (Rust)

A real-time International Space Station tracker built with Rust and Rocket.

## Features

- Real-time tracking of the International Space Station
- Interactive map showing the current position and path history
- Updates position based on configurable polling interval using the Open Notify API
- Configurable position history storage capacity
- Clean REST API for accessing position data
- Responsive web interface with Leaflet.js

## Technologies

- **Backend**: Rust, Rocket web framework
- **Frontend**: HTML, CSS, JavaScript, Leaflet.js
- **APIs**: Open Notify ISS Position API

## Getting Started

### Prerequisites

- Rust and Cargo (latest stable version)
- Internet connection (to fetch ISS position data)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/iss_tracker_rust.git
   cd iss_tracker_rust
   ```

2. Build the project:
   ```bash
   cargo build --release
   ```

### Running the Application

1. Start the server:
   ```bash
   # Run with default settings
   cargo run --release
   
   # Or specify custom configuration
   cargo run --release -- --max-positions 5000 --poll-interval 5 --timeout 10
   ```

   Available command line options:
   - `--max-positions <NUMBER>` or `-m`: How many ISS positions to keep stored (default: 15000)
   - `--poll-interval <SECONDS>` or `-p`: The interval between ISS position checks (default: 2)
   - `--timeout <SECONDS>` or `-t`: How long to wait before timing out a position check (default: 3)

2. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

## API Endpoints

The application provides the following REST API endpoints:

- `GET /api/positions` - Returns all stored ISS positions
- `GET /api/latest` - Returns only the most recent position
- `GET /api/status` - Returns information about the tracker's status

### Example API Response (Latest Position)

```json
{
  "last_update": "2023-04-24T02:30:45Z",
  "position": {
    "timestamp": 1682304645,
    "datetime": "2023-04-24T02:30:45Z",
    "latitude": 45.1234,
    "longitude": -75.5678
  }
}
```

## Configuration

The application uses the following default settings:

- Maximum stored positions: 15000
- Update interval: 2 seconds
- Position check timeout: 3 seconds
- Web server port: 8000 (fixed, not configurable via command line)

These settings can be customized using command line arguments as shown in the "Running the Application" section.

## Project Structure

```
iss_tracker_rust/
├── src/
│   └── main.rs         # Main application code
├── static/             # Static web assets
│   ├── index.html      # Main HTML page
│   ├── style.css       # CSS styles
│   └── script.js       # Frontend JavaScript
└── Cargo.toml          # Rust dependencies and project config
```

## Acknowledgments

- [Open Notify API](http://open-notify.org/) for providing ISS position data
- [Rocket](https://rocket.rs/) for the Rust web framework
- [Leaflet](https://leafletjs.com/) for the interactive mapping library
