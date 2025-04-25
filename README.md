# ISS Tracker (Rust)

A real-time International Space Station tracker built with Rust and Rocket.

![ISS Tracker](https://via.placeholder.com/800x400?text=ISS+Tracker+Screenshot)

## Features

- Real-time tracking of the International Space Station
- Interactive map showing the current position and path history
- Updates every 10 seconds using the Open Notify API
- Stores up to 3000 position records
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
   cargo run --release
   ```

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

- Maximum stored positions: 3000
- Update interval: 2 seconds
- Web server port: 8000

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
