// GET /api/me — cek apakah request membawa session yang valid
const { getSessionFromReq, sendJson } = require('./_auth');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Metode tidak diizinkan' });
  }
  const session = getSessionFromReq(req);
  if (!session) {
    return sendJson(res, 200, { ok: true, loggedIn: false });
  }
  sendJson(res, 200, { ok: true, loggedIn: true, user: session.u });
};
