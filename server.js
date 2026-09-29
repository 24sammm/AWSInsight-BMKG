// Server lokal untuk development: node server.js → http://localhost:3000
// Menyajikan file statis (index.html, logo, dll) + endpoint di folder api/.
// Hanya untuk tes di komputer sendiri — untuk produksi tetap deploy ke Vercel.
const http = require('http');
const fs = require('fs');
const path = require('path');

// Baca .env.local → process.env (tanpa dependency)
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const handlers = {
  '/api/login': require('./api/login.js'),
  '/api/me': require('./api/me.js'),
  '/api/logout': require('./api/logout.js'),
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Endpoint api/ → handler serverless
  const handler = handlers[urlPath];
  if (handler) {
    if (req.method === 'POST' || req.method === 'PUT') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => { req.body = body; handler(req, res); });
    } else {
      handler(req, res);
    }
    return;
  }

  // File statis
  let file = urlPath === '/' ? '/index.html' : urlPath;
  file = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
  const full = path.join(__dirname, file);
  if (!full.startsWith(__dirname)) { res.statusCode = 403; return res.end('Forbidden'); }
  fs.readFile(full, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', MIME[path.extname(full).toLowerCase()] || 'application/octet-stream');
    res.end(data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Buka http://localhost:${PORT} di browser`));
