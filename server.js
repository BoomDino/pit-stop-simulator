/**
 * RPA PIT STOP - High Performance Unified Frontend & Backend HTTP Server
 * Provides:
 * 1. Backend REST API:
 *    - GET  /api/health      -> Server status & active RPA bot diagnostics
 *    - GET  /api/leaderboard -> Persistent backend leaderboard rankings
 *    - POST /api/leaderboard -> Records racer scores into backend JSON store
 *    - GET  /api/telemetry   -> Live telemetry readings & pressure sensors
 * 2. Frontend Static File Server:
 *    - Serves index.html, css/style.css, js/*.js with correct MIME types
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;
const DB_FILE = path.join(BASE_DIR, 'leaderboard.json');

const DEFAULT_LEADERBOARD = [
  { name: 'BOT-TITAN (RPA Alpha)', time: 15420, accuracy: 100, perfectHits: 6, date: '2026-10-25' },
  { name: 'Max V. (Red Bull Sim)', time: 17850, accuracy: 92, perfectHits: 5, date: '2026-10-26' },
  { name: 'Lando Wrench (McLaren)', time: 19940, accuracy: 88, perfectHits: 4, date: '2026-10-28' },
  { name: 'Cyber Mech #44', time: 23150, accuracy: 83, perfectHits: 3, date: '2026-10-29' },
  { name: 'Pit Academy Rookie', time: 31200, accuracy: 71, perfectHits: 2, date: '2026-10-30' }
];

function getLeaderboardData() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_LEADERBOARD, null, 2), 'utf-8');
      return DEFAULT_LEADERBOARD;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading leaderboard DB:', err);
    return DEFAULT_LEADERBOARD;
  }
}

function saveLeaderboardData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing leaderboard DB:', err);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Global CORS & JSON headers for API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // ==========================================
  // BACKEND REST API ROUTES
  // ==========================================

  // 1. Health & Status Check
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ONLINE',
      system: 'RPA PIT STOP CONTROLLER',
      version: '4.2.0',
      uptimeSec: process.uptime(),
      activeBots: [
        { id: 'BOT-JACK-F01', role: 'Front Jack Actuator', status: 'READY' },
        { id: 'BOT-WHEEL-FL', role: 'Front-Left Wheel Gun', status: 'READY' },
        { id: 'BOT-WHEEL-FR', role: 'Front-Right Wheel Gun', status: 'READY' },
        { id: 'BOT-WHEEL-RL', role: 'Rear-Left Wheel Gun', status: 'READY' },
        { id: 'BOT-WHEEL-RR', role: 'Rear-Right Wheel Gun', status: 'READY' },
        { id: 'BOT-JACK-R02', role: 'Rear Jack & Release', status: 'READY' }
      ]
    }));
    return;
  }

  // 2. Telemetry Diagnostics
  if (pathname === '/api/telemetry') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      pneumaticLinePressurePsi: (118 + Math.random() * 4).toFixed(1),
      airGunTorqueNm: 460,
      cvConfidencePct: (99.2 + Math.random() * 0.7).toFixed(2),
      opticalSyncLatencyMs: (1.2 + Math.random() * 0.5).toFixed(2),
      ambientPitTempC: 28.4
    }));
    return;
  }

  // 3. Leaderboard GET
  if (pathname === '/api/leaderboard' && req.method === 'GET') {
    const list = getLeaderboardData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(list));
    return;
  }

  // 4. Leaderboard POST (Save new score)
  if (pathname === '/api/leaderboard' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const name = (payload.name || 'Anonymous Racer').trim().slice(0, 20);
        const time = Math.round(Number(payload.time) || 99999);
        const accuracy = Math.round(Number(payload.accuracy) || 0);
        const perfectHits = Math.min(6, Math.max(0, Number(payload.perfectHits) || 0));
        const date = new Date().toISOString().split('T')[0];

        const list = getLeaderboardData();
        list.push({ name, time, accuracy, perfectHits, date });
        list.sort((a, b) => a.time - b.time);
        const trimmed = list.slice(0, 30);
        saveLeaderboardData(trimmed);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, entry: { name, time, accuracy, perfectHits, date }, rankings: trimmed }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // 5. Leaderboard DELETE (Reset to default seeds)
  if (pathname === '/api/leaderboard' && req.method === 'DELETE') {
    saveLeaderboardData(DEFAULT_LEADERBOARD);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Leaderboard reset to defaults', rankings: DEFAULT_LEADERBOARD }));
    return;
  }

  // ==========================================
  // FRONTEND STATIC ASSETS (SECURE FILE SERVER)
  // ==========================================
  let reqPath = decodeURIComponent(pathname);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  // Secure path resolution to prevent directory traversal outside BASE_DIR
  const filePath = path.resolve(BASE_DIR, '.' + reqPath);

  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n=============================================================`);
  console.log(`  🏎️  RPA PIT STOP: PRECISION UNDER PRESSURE`);
  console.log(`  -----------------------------------------------------------`);
  console.log(`  🌐 Frontend Server: ${url}`);
  console.log(`  ⚙️  Backend Health:   ${url}/api/health`);
  console.log(`  🏆 Backend Scores:   ${url}/api/leaderboard`);
  console.log(`  📊 Telemetry Stream: ${url}/api/telemetry`);
  console.log(`=============================================================\n`);

  // Auto-launch browser safely across OS environments
  if (process.env.AUTO_OPEN !== '0') {
    const startCmd = process.platform === 'win32' ? `start ${url}` :
                     process.platform === 'darwin' ? `open ${url}` :
                     `xdg-open ${url}`;
    exec(startCmd, () => {});
  }
});
