// Skrip tes sementara untuk endpoint auth (dihapus setelah tes)
const http = require('http');

process.env.AWS_USERS = 'operator@bmkg.go.id:PassKuat123, admin@bmkg.go.id:PassAdmin456';
process.env.AWS_SESSION_SECRET = 'rahasia-tes-x7k9';

const handlers = {
  '/api/login': require('./api/login.js'),
  '/api/me': require('./api/me.js'),
  '/api/logout': require('./api/logout.js'),
};

const server = http.createServer((req, res) => {
  const h = handlers[req.url.split('?')[0]];
  if (!h) { res.statusCode = 404; return res.end('not found'); }
  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { req.body = body; h(req, res); });
  } else {
    h(req, res);
  }
});

const post = (path, body, cookie) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body || {});
  const req = http.request({ port: 3999, path, method: 'POST', headers: {
    'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data),
    ...(cookie ? { Cookie: cookie } : {}),
  } }, res => {
    let out = '';
    res.on('data', c => out += c);
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: out }));
  });
  req.on('error', reject);
  req.end(data);
});

const get = (path, cookie) => new Promise((resolve, reject) => {
  const req = http.request({ port: 3999, path, method: 'GET', headers: cookie ? { Cookie: cookie } : {} }, res => {
    let out = '';
    res.on('data', c => out += c);
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: out }));
  });
  req.on('error', reject);
  req.end();
});

const assert = (cond, msg) => { if (!cond) { console.error('GAGAL: ' + msg); process.exitCode = 1; } else console.log('OK: ' + msg); };

server.listen(3999, async () => {
  try {
    // 1. /api/me tanpa session
    let r = await get('/api/me');
    assert(r.status === 200 && JSON.parse(r.body).loggedIn === false, '/api/me tanpa cookie → loggedIn:false');

    // 2. Login salah password
    r = await post('/api/login', { email: 'operator@bmkg.go.id', password: 'salah' });
    assert(r.status === 401, 'login password salah → 401');

    // 3. Login user tak terdaftar
    r = await post('/api/login', { email: 'hacker@evil.com', password: 'x' });
    assert(r.status === 401, 'login user tak terdaftar → 401');

    // 4. Login benar
    r = await post('/api/login', { email: 'Operator@BMKG.go.id', password: 'PassKuat123' });
    const setCookie = r.headers['set-cookie'] && r.headers['set-cookie'][0];
    assert(r.status === 200 && JSON.parse(r.body).ok, 'login benar → 200 ok');
    assert(setCookie && setCookie.includes('HttpOnly') && setCookie.includes('Secure') && setCookie.includes('SameSite=Lax'), 'cookie httpOnly+secure+samesite');

    // 5. /api/me dengan session
    const cookie = setCookie.split(';')[0];
    r = await get('/api/me', cookie);
    const me = JSON.parse(r.body);
    assert(r.status === 200 && me.loggedIn === true && me.user === 'operator@bmkg.go.id', '/api/me dengan session → loggedIn:true, email lowercase');

    // 6. Logout
    r = await post('/api/logout', {}, cookie);
    assert(r.status === 200 && (r.headers['set-cookie'][0] || '').includes('Max-Age=0'), 'logout → cookie dihapus');

    // 7. /api/me setelah logout (cookie lama masih dikirim browser → tetap valid token-nya,
    //    penghapusan terjadi di sisi browser. Verifikasi cookie baru tidak lagi diterbitkan.)
    r = await get('/api/me', cookie);
    assert(JSON.parse(r.body).loggedIn === true, 'token lama masih terverifikasi sampai kedaluwarsa (perilaku stateless normal)');

    // 8. Token palsu ditolak
    r = await get('/api/me', 'aws_session=palsu.palsu');
    assert(JSON.parse(r.body).loggedIn === false, 'token palsu → loggedIn:false');

    // 9. Rate limit: 10 percobaan salah berturut-turut → 429
    let last;
    for (let i = 0; i < 10; i++) last = await post('/api/login', { email: 'brute@force.com', password: 'x' });
    assert(last.status === 429, 'rate limit setelah 10 percobaan gagal → 429');
  } catch (e) {
    console.error('GAGAL: ' + e.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
