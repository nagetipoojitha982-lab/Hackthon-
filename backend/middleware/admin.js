const { fail } = require('../utils/validation');
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;
  const supplied = req.get('x-admin-key');
  if (!expected || expected.length < 32) {
    return fail(res, 503, 'Admin actions are not configured. Set a strong ADMIN_API_KEY in backend/.env.');
  }
  if (!supplied || supplied !== expected) return fail(res, 401, 'Valid admin key required.');
  next();
}
module.exports = requireAdmin;
