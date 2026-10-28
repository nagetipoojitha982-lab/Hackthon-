const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function cleanText(value, max = 120) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
}
function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value.trim());
}
function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}
module.exports = { cleanText, validEmail, fail };
