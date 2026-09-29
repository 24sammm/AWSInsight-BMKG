// POST /api/login  — cek email+password, set session cookie httpOnly
const { checkCredentials, createSessionToken, sessionCookie, sendJson, rateLimit } = require('./_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Metode tidak diizinkan' });
  }

  let body = {};
  try {
    body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Body bukan JSON yang valid' });
  }

  const email = String(body.email || '').trim();
  const password = String(body.password || '');

  // Rate limit per IP+email untuk memperlambat percobaan brute force
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '?';
  const rl = rateLimit(ip + '|' + email.toLowerCase());
  if (!rl.allowed) {
    return sendJson(res, 429, { ok: false, error: 'Terlalu banyak percobaan. Coba lagi dalam 10 menit.' });
  }

  if (!checkCredentials(email, password)) {
    return sendJson(res, 401, { ok: false, error: 'Email atau password salah.' });
  }

  sendJson(res, 200, { ok: true, user: email.toLowerCase() }, [sessionCookie(createSessionToken(email))]);
};
