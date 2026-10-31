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
const DB_FILE = process.env.LEADERBOARD_PATH || path.join(BASE_DIR, 'leaderboard.json');

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

  // Same-origin proxy to FastAPI. No UiPath credentials live in this server/browser.
  if (pathname === '/api/health' || pathname === '/api/uipath/status' ||
      /^\/api\/uipath\/job\/\d+$/.test(pathname) ||
      pathname === '/api/pitstop/event' || pathname === '/api/pitstop/logs') {
    const upstream = http.request({hostname: '127.0.0.1', port: process.env.FASTAPI_PORT || 8000,
      path: pathname + parsedUrl.search, method: req.method,
      headers: {'Content-Type': 'application/json'}, timeout: 40000}, response => {
      res.writeHead(response.statusCode, {'Content-Type': 'application/json'});
      response.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(503, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({detail: 'FastAPI unavailable; game remains playable'}));
    });
    req.pipe(upstream);
    return;
  }

  // 2. Telemetry Diagnostics
  if (pathname === '/api/telemetry') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      simulated: true,
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
  let reqPath;
  try { reqPath = decodeURIComponent(pathname); }
  catch (_) { res.writeHead(400); res.end('Invalid path'); return; }
  if (reqPath === '/') reqPath = '/index.html';
  // Only public game files; never serve backend/.env, SQLite, .git or source configs.
  const publicFiles = new Set(['/index.html', '/css/style.css', '/js/audio.js',
    '/js/particles.js', '/js/leaderboard.js', '/js/rpa-engine.js', '/js/game.js']);
  const publicAsset = /^\/assets\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|svg|ico)$/.test(reqPath);
  if (!publicFiles.has(reqPath) && !publicAsset) {
    res.writeHead(404); res.end('404 Not Found'); return;
  }
  const filePath = path.resolve(BASE_DIR, '.' + reqPath);

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

server.listen(PORT, '0.0.0.0', () => {
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
