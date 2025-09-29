const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Mock data
const mockStations = [
  {
    id: '1',
    name: 'Downtown Station Alpha',
    address: '123 Main St, Downtown',
    latitude: 37.7749,
    longitude: -122.4194,
    totalPorts: 8,
    availablePorts: 3,
    status: 'online',
    revenue: 1250,
    utilization: 0.75,
  },
  {
    id: '2',
    name: 'Mall Charging Hub',
    address: '456 Shopping Blvd, Midtown',
    latitude: 37.7849,
    longitude: -122.4094,
    totalPorts: 12,
    availablePorts: 7,
    status: 'online',
    revenue: 2150,
    utilization: 0.58,
  },
  {
    id: '3',
    name: 'Highway Rest Stop',
    address: '789 Interstate Dr, Highway',
    latitude: 37.7649,
    longitude: -122.4294,
    totalPorts: 6,
    availablePorts: 0,
    status: 'maintenance',
    revenue: 890,
    utilization: 1.0,
  },
];

const mockSessions = [
  {
    id: '1',
    stationName: 'Downtown Station Alpha',
    portNumber: 3,
    customerName: 'John Doe',
    vehicleModel: 'Tesla Model 3',
    startTime: new Date(Date.now() - 1800000),
    currentEnergy: 45.5,
    targetEnergy: 75.0,
    chargingRate: 22.5,
    status: 'charging',
  },
  {
    id: '2',
    stationName: 'Mall Charging Hub',
    portNumber: 7,
    customerName: 'Jane Smith',
    vehicleModel: 'BMW iX',
    startTime: new Date(Date.now() - 2700000),
    currentEnergy: 68.2,
    targetEnergy: 80.0,
    chargingRate: 18.0,
    status: 'charging',
  },
];

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'EV Power Station Management Demo',
    version: '1.0.0'
  });
});

app.get('/api/stations', (req, res) => {
  const { search, status } = req.query;
  let filteredStations = [...mockStations];

  if (search) {
    filteredStations = filteredStations.filter(station =>
      station.name.toLowerCase().includes(search.toLowerCase()) ||
      station.address.toLowerCase().includes(search.toLowerCase())
    );
  }

  if (status && status !== 'all') {
    filteredStations = filteredStations.filter(station => station.status === status);
  }

  res.json({
    stations: filteredStations,
    total: filteredStations.length,
    pagination: {
      page: 1,
      limit: 20,
      total: filteredStations.length,
      pages: 1
    }
  });
});

app.get('/api/stations/:id', (req, res) => {
  const station = mockStations.find(s => s.id === req.params.id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  res.json(station);
});

app.get('/api/sessions/active', (req, res) => {
  res.json({
    sessions: mockSessions,
    total: mockSessions.length,
    totalPowerOutput: mockSessions.reduce((sum, session) => sum + session.chargingRate, 0)
  });
});

app.get('/api/analytics/overview', (req, res) => {
  res.json({
    totalStations: mockStations.length,
    activeSessions: mockSessions.length,
    revenueToday: 2547,
    utilizationRate: 0.68,
    revenueData: [
      { month: 'Jan', revenue: 12500, sessions: 450 },
      { month: 'Feb', revenue: 15600, sessions: 520 },
      { month: 'Mar', revenue: 18200, sessions: 680 },
      { month: 'Apr', revenue: 22100, sessions: 750 },
      { month: 'May', revenue: 19800, sessions: 690 },
      { month: 'Jun', revenue: 25400, sessions: 820 },
    ],
    usageData: [
      { hour: '00:00', usage: 12 },
      { hour: '06:00', usage: 45 },
      { hour: '12:00', usage: 78 },
      { hour: '18:00', usage: 92 },
      { hour: '21:00', usage: 65 },
    ]
  });
});

app.post('/api/stations', (req, res) => {
  const newStation = {
    id: (mockStations.length + 1).toString(),
    ...req.body,
    status: 'online',
    revenue: 0,
    utilization: 0,
    availablePorts: req.body.totalPorts || 0
  };

  mockStations.push(newStation);
  res.status(201).json(newStation);
});

// Serve static HTML demo page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EV Power Station Management - Demo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 2rem; border-radius: 10px; margin-bottom: 2rem; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: white; padding: 1.5rem; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .stat-number { font-size: 2rem; font-weight: bold; color: #22c55e; }
        .stat-label { color: #666; margin-top: 0.5rem; }
        .stations-section { background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 2rem; }
        .station-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
        .station-status { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.875rem; font-weight: 500; }
        .status-online { background: #dcfce7; color: #16a34a; }
        .status-maintenance { background: #fef3c7; color: #d97706; }
        .api-section { background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .endpoint { background: #f8fafc; padding: 1rem; border-radius: 6px; margin-bottom: 1rem; border-left: 4px solid #22c55e; }
        .method { color: #22c55e; font-weight: bold; }
        button { background: #22c55e; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; margin: 0.25rem; }
        button:hover { background: #16a34a; }
        .response { background: #1f2937; color: #f9fafb; padding: 1rem; border-radius: 6px; margin-top: 1rem; overflow-x: auto; }
        .sessions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-top: 1rem; }
        .session-card { background: #f8fafc; padding: 1rem; border-radius: 8px; border-left: 4px solid #3b82f6; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔌 EV Power Station Management Platform</h1>
            <p>Comprehensive SaaS solution for managing EV charging infrastructure</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number" id="totalStations">24</div>
                <div class="stat-label">Total Stations</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="activeSessions">156</div>
                <div class="stat-label">Active Sessions</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="revenueToday">$2,547</div>
                <div class="stat-label">Revenue Today</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="utilizationRate">68%</div>
                <div class="stat-label">Utilization Rate</div>
            </div>
        </div>

        <div class="stations-section">
            <h2>Charging Stations</h2>
            <div id="stationsList"></div>
        </div>

        <div class="stations-section">
            <h2>Active Charging Sessions</h2>
            <div id="sessionsList"></div>
        </div>

        <div class="api-section">
            <h2>API Testing</h2>
            <p>Test the live API endpoints:</p>

            <div class="endpoint">
                <span class="method">GET</span> /api/health
                <button onclick="testAPI('/api/health')">Test Health Check</button>
            </div>

            <div class="endpoint">
                <span class="method">GET</span> /api/stations
                <button onclick="testAPI('/api/stations')">Get All Stations</button>
            </div>

            <div class="endpoint">
                <span class="method">GET</span> /api/sessions/active
                <button onclick="testAPI('/api/sessions/active')">Get Active Sessions</button>
            </div>

            <div class="endpoint">
                <span class="method">GET</span> /api/analytics/overview
                <button onclick="testAPI('/api/analytics/overview')">Get Analytics</button>
            </div>

            <div id="apiResponse" class="response" style="display: none;"></div>
        </div>
    </div>

    <script>
        // Load initial data
        loadDashboardData();

        async function loadDashboardData() {
            try {
                // Load stations
                const stationsRes = await fetch('/api/stations');
                const stationsData = await stationsRes.json();
                displayStations(stationsData.stations);

                // Load active sessions
                const sessionsRes = await fetch('/api/sessions/active');
                const sessionsData = await sessionsRes.json();
                displaySessions(sessionsData.sessions);

                // Load analytics
                const analyticsRes = await fetch('/api/analytics/overview');
                const analyticsData = await analyticsRes.json();
                updateStats(analyticsData);
            } catch (error) {
                console.error('Error loading data:', error);
            }
        }

        function displayStations(stations) {
            const container = document.getElementById('stationsList');
            container.innerHTML = stations.map(station => \`
                <div class="station-card">
                    <h3>\${station.name}</h3>
                    <p>\${station.address}</p>
                    <p>Ports: \${station.availablePorts}/\${station.totalPorts} available</p>
                    <p>Revenue: $\${station.revenue}</p>
                    <span class="station-status status-\${station.status}">\${station.status}</span>
                </div>
            \`).join('');
        }

        function displaySessions(sessions) {
            const container = document.getElementById('sessionsList');
            container.innerHTML = '<div class="sessions-grid">' + sessions.map(session => \`
                <div class="session-card">
                    <h4>\${session.stationName} - Port \${session.portNumber}</h4>
                    <p><strong>Customer:</strong> \${session.customerName}</p>
                    <p><strong>Vehicle:</strong> \${session.vehicleModel}</p>
                    <p><strong>Energy:</strong> \${session.currentEnergy}/\${session.targetEnergy} kWh</p>
                    <p><strong>Charging Rate:</strong> \${session.chargingRate} kW</p>
                    <p><strong>Duration:</strong> \${Math.round((Date.now() - new Date(session.startTime)) / 60000)} min</p>
                </div>
            \`).join('') + '</div>';
        }

        function updateStats(data) {
            document.getElementById('totalStations').textContent = data.totalStations;
            document.getElementById('activeSessions').textContent = data.activeSessions;
            document.getElementById('revenueToday').textContent = '$' + data.revenueToday.toLocaleString();
            document.getElementById('utilizationRate').textContent = Math.round(data.utilizationRate * 100) + '%';
        }

        async function testAPI(endpoint) {
            try {
                const response = await fetch(endpoint);
                const data = await response.json();
                const responseDiv = document.getElementById('apiResponse');
                responseDiv.style.display = 'block';
                responseDiv.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                const responseDiv = document.getElementById('apiResponse');
                responseDiv.style.display = 'block';
                responseDiv.textContent = 'Error: ' + error.message;
            }
        }

        // Auto-refresh data every 30 seconds
        setInterval(loadDashboardData, 30000);
    </script>
</body>
</html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 EV Power Station Management Demo Server Running!

📍 URL: http://localhost:${PORT}
📊 Dashboard: http://localhost:${PORT}
🔧 Health Check: http://localhost:${PORT}/api/health
📋 API Docs: http://localhost:${PORT}/api/stations

🎯 Features Available:
- Station Management Dashboard
- Real-time Session Monitoring
- Revenue Analytics
- Live API Testing
- Mock Data Simulation

Press Ctrl+C to stop the server
  `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Server shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\\nServer shutting down gracefully...');
  process.exit(0);
});