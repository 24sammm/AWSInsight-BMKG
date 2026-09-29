// Helper autentikasi bersama untuk api/login.js, api/me.js, api/logout.js
// Kredensial user disimpan di Environment Variables Vercel, bukan di kode.
//
//   AWS_USERS = "budi@bmkg.go.id:PasswordKuat123, siti@bmkg.go.id:PasswordLain456"
//   AWS_SESSION_SECRET = "kalimat-acak-yang-panjang-dan-rahasia"
//
// Session memakai cookie httpOnly bertanda tangan HMAC-SHA256, jadi tidak butuh
// database dan aman untuk lingkungan serverless (stateless).

const crypto = require('crypto');

const COOKIE_NAME = 'aws_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 jam

// ---------- Kredensial dari environment variables ----------

function getUsers() {
  const raw = process.env.AWS_USERS || '';
  const users = new Map();
  for (const pair of raw.split(',')) {
    const s = pair.trim();
    if (!s) continue;
    const idx = s.indexOf(':');
    if (idx <= 0) continue;
    const email = s.slice(0, idx).trim().toLowerCase();
    const pass = s.slice(idx + 1).trim();
    if (email && pass) users.set(email, pass);
  }
  return users;
}

function checkCredentials(email, password) {
  if (!email || !password) return false;
  const users = getUsers();
  const expected = users.get(String(email).trim().toLowerCase());
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(password));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Token session: base64url(payload).hmac ----------

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function sign(payloadB64) {
  const secret = process.env.AWS_SESSION_SECRET || '';
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

function createSessionToken(email) {
  const payload = {
    u: String(email).trim().toLowerCase(),
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return payloadB64 + '.' + sign(payloadB64);
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload || typeof payload.u !== 'string' || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Cookie helpers ----------

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function getSessionFromReq(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  return verifySessionToken(token);
}

function sessionCookie(token) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  return attrs.join('; ');
}

const CLEAR_COOKIE = `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

// ---------- Respon JSON ----------

function sendJson(res, status, body, extraHeaders = []) {
  res.statusCode = status;
  for (const h of extraHeaders) res.setHeader('Set-Cookie', h);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Simple rate limit per (IP + email) untuk memperlambat brute force
const attempts = new Map(); // key -> { count, resetAt }
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;

function rateLimit(key) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now > rec.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }
  rec.count += 1;
  return { allowed: rec.count <= MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - rec.count) };
}

module.exports = {
  COOKIE_NAME,
  CLEAR_COOKIE,
  SESSION_TTL_MS,
  checkCredentials,
  createSessionToken,
  getSessionFromReq,
  sendJson,
  sessionCookie,
  rateLimit,
};
