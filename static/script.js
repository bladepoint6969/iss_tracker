// Path color settings with brightness percentages for visual trail fade effect
const PATH_COLOR_CURRENT = 'rgb(255, 0, 0)';      // 100% brightness - current segment
const PATH_COLOR_75PCT = 'rgb(191, 0, 0)';        // 75% brightness - newest historical segment
const PATH_COLOR_50PCT = 'rgb(128, 0, 0)';        // 50% brightness - second newest segment
const PATH_COLOR_25PCT = 'rgb(64, 0, 0)';         // 25% brightness - third newest segment
const PATH_COLOR_0PCT = 'rgb(0, 0, 0)';           // 0% brightness - oldest segment

// Initialize the map centered at equator
const map = L.map('map', {
    center: [0, 0],
    zoom: 3,
    worldCopyJump: false,
    maxBounds: [[-90, -180], [90, 180]]
});

// Define both tile layers
const streetTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    noWrap: true
});

const terrainTileLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
    noWrap: true
});

// Start with the street map as default
let currentTileLayer = streetTileLayer;
currentTileLayer.addTo(map);
let isTerrainView = false;

// Create a custom icon for the ISS
const issIcon = L.divIcon({
    className: 'iss-icon',
    iconSize: [30, 30]
});

// Create a marker for the ISS with the custom icon
let issMarker = L.marker([0, 0], { icon: issIcon }).addTo(map);

// Create a path to track the ISS movement
let issPath = L.polyline([], { color: PATH_COLOR_CURRENT, weight: 2 }).addTo(map);

// Global variables to track path segments
let pathSegments = [];
let currentSegment = [];
const MAX_PATH_SEGMENTS = 4; // Maximum number of historical path segments to keep

// API configuration
const API_BASE_URL = ''; // Empty string means same origin
const UPDATE_INTERVAL = 5000; // 5 seconds

// Connection status tracking
let isConnected = true;
let connectionRetries = 0;
const MAX_RETRIES = 3;

// Update the connection status indicator in the UI
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    isConnected = connected;

    if (connected) {
        statusElement.textContent = 'Connected';
        statusElement.className = 'connected';
        connectionRetries = 0;
    } else {
        statusElement.textContent = 'Disconnected - Retrying...';
        statusElement.className = 'disconnected';
    }
}

// Update the ISS path with appropriate colors based on age
function updatePathColors() {
    issPath.setStyle({ color: PATH_COLOR_CURRENT });

    for (let i = 0; i < pathSegments.length; i++) {
        let color;
        // Calculate color based on position from newest to oldest
        switch (pathSegments.length - 1 - i) {
            case 0: color = PATH_COLOR_75PCT; break;
            case 1: color = PATH_COLOR_50PCT; break;
            case 2: color = PATH_COLOR_25PCT; break;
            default: color = PATH_COLOR_0PCT;
        }
        pathSegments[i].setStyle({ color: color });
    }
}

// Load the initial position history from the server
async function loadPositionHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/positions`);
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        if (data.positions && data.positions.length > 0) {
            // Clear existing segments and paths
            currentSegment = [];

            // Remove any existing polylines
            pathSegments.forEach(segment => map.removeLayer(segment));
            pathSegments = [];

            // Process positions to handle international date line crossings
            let segments = [];
            let tempSegment = [];

            for (let i = 0; i < data.positions.length; i++) {
                const pos = data.positions[i];
                const point = [pos.latitude, pos.longitude];

                if (i > 0) {
                    const prevPos = data.positions[i-1];
                    // Check for date line crossing (longitude jump > 180 degrees)
                    if (Math.abs(prevPos.longitude - pos.longitude) > 180) {
                        // End current segment and start a new one
                        if (tempSegment.length > 0) {
                            segments.push(tempSegment);
                            tempSegment = [point];
                        }
                    } else {
                        tempSegment.push(point);
                    }
                } else {
                    // First point
                    tempSegment.push(point);
                }
            }

            // Add the last segment if not empty
            if (tempSegment.length > 0) {
                segments.push(tempSegment);
            }

            // Keep only the most recent segments (plus current)
            if (segments.length > MAX_PATH_SEGMENTS + 1) {
                segments = segments.slice(segments.length - (MAX_PATH_SEGMENTS + 1));
            }

            // The last segment becomes the current segment
            if (segments.length > 0) {
                currentSegment = segments.pop();
                issPath.setLatLngs(currentSegment);
            }

            // Add the historical segments to the map
            segments.forEach((segmentPoints, index) => {
                const agePosition = segments.length - 1 - index;
                let segmentColor;
                switch (agePosition) {
                    case 0: segmentColor = PATH_COLOR_75PCT; break;
                    case 1: segmentColor = PATH_COLOR_50PCT; break;
                    case 2: segmentColor = PATH_COLOR_25PCT; break;
                    default: segmentColor = PATH_COLOR_0PCT;
                }
                const segment = L.polyline(segmentPoints, { color: segmentColor, weight: 2 }).addTo(map);
                pathSegments.push(segment);
            });

            // Update the marker to the latest position
            const latestPos = data.positions[data.positions.length - 1];
            issMarker.setLatLng([latestPos.latitude, latestPos.longitude]);

            // Update the info panel
            document.getElementById('lat').textContent = latestPos.latitude.toFixed(4);
            document.getElementById('lon').textContent = latestPos.longitude.toFixed(4);
            document.getElementById('timestamp').textContent = new Date(latestPos.datetime).toLocaleTimeString();
            document.getElementById('positions-count').textContent = data.positions.length;
            document.getElementById('segments-count').textContent = pathSegments.length;
            document.getElementById('max-segments').textContent = MAX_PATH_SEGMENTS;

            console.log(`Loaded ${data.positions.length} positions from server (${pathSegments.length} historical segments + current)`);
            updatePathColors();
            updateConnectionStatus(true);
        }
    } catch (error) {
        console.error('Error loading position history:', error);
        updateConnectionStatus(false);
    }
}

// Fetch the latest ISS position from the server
async function getISSPosition() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/latest`);
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        if (data.position) {
            const latitude = parseFloat(data.position.latitude);
            const longitude = parseFloat(data.position.longitude);
            const point = [latitude, longitude];

            // Update the marker position
            issMarker.setLatLng(point);

            // Handle International Date Line crossing
            if (currentSegment.length > 0) {
                const lastPoint = currentSegment[currentSegment.length - 1];
                const lastLon = lastPoint[1];

                // If longitude difference > 180 degrees, we've crossed the date line
                if (Math.abs(lastLon - longitude) > 180) {
                    console.log("Date line crossing detected in real-time update");

                    // Save the current segment as a new polyline
                    const segment = L.polyline(currentSegment, { color: PATH_COLOR_75PCT, weight: 2 }).addTo(map);
                    pathSegments.push(segment);

                    // Maintain maximum number of path segments
                    if (pathSegments.length > MAX_PATH_SEGMENTS) {
                        // Remove oldest segment
                        map.removeLayer(pathSegments[0]);
                        pathSegments.shift();

                        // Update colors of all segments
                        updatePathColors();
                    }

                    // Start a new segment with the current point
                    currentSegment = [point];
                    issPath.setLatLngs(currentSegment);
                } else {
                    // Check if this point is the same as the last point in the segment
                    const lastPoint = currentSegment[currentSegment.length - 1];
                    if (lastPoint[0] !== point[0] || lastPoint[1] !== point[1]) {
                        // Only add the point if it's different from the last one
                        currentSegment.push(point);
                        issPath.setLatLngs(currentSegment);
                    } else {
                        console.log("Skipping duplicate point:", point);
                    }
                }
            } else {
                // First position in this segment
                currentSegment.push(point);
                issPath.setLatLngs(currentSegment);
            }

            // Calculate total visible positions
            const totalPositions = currentSegment.length +
                pathSegments.reduce((sum, segment) => sum + segment.getLatLngs().length, 0);

            // Update the info panel
            document.getElementById('lat').textContent = latitude.toFixed(4);
            document.getElementById('lon').textContent = longitude.toFixed(4);
            document.getElementById('timestamp').textContent = new Date(data.position.datetime).toLocaleTimeString();
            document.getElementById('positions-count').textContent = totalPositions;
            document.getElementById('segments-count').textContent = pathSegments.length;
            document.getElementById('max-segments').textContent = MAX_PATH_SEGMENTS;

            console.log(`ISS Position: ${latitude}, ${longitude} (Segments: ${pathSegments.length} + current)`);
            updatePathColors();
            updateConnectionStatus(true);
        }
    } catch (error) {
        console.error('Error fetching ISS position:', error);
        connectionRetries++;

        if (connectionRetries > MAX_RETRIES) {
            updateConnectionStatus(false);
        }
    }
}

// Reset map view to equator
function resetMapView() {
    map.setView([0, 0], map.getZoom());
}

// Toggle between street and terrain views
function toggleTerrainView() {
    if (isTerrainView) {
        map.removeLayer(currentTileLayer);
        currentTileLayer = streetTileLayer;
        currentTileLayer.addTo(map);
        isTerrainView = false;
        document.getElementById('terrain-toggle-btn').textContent = 'Show Terrain';
    } else {
        map.removeLayer(currentTileLayer);
        currentTileLayer = terrainTileLayer;
        currentTileLayer.addTo(map);
        isTerrainView = true;
        document.getElementById('terrain-toggle-btn').textContent = 'Show Street Map';
    }
}

// Set up the buttons
function setupButtons() {
    document.getElementById('reset-view-btn').addEventListener('click', resetMapView);
    document.getElementById('terrain-toggle-btn').addEventListener('click', toggleTerrainView);
}

// Initial load of position history
loadPositionHistory();

// Set up the buttons
setupButtons();

// Update the position regularly
setInterval(getISSPosition, UPDATE_INTERVAL);
