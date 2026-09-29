// POST /api/logout — hapus session cookie
const { CLEAR_COOKIE, sendJson } = require('./_auth');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Metode tidak diizinkan' });
  }
  sendJson(res, 200, { ok: true }, [CLEAR_COOKIE]);
};
