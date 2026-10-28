require('dotenv').config();
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const supabase = require('./supabase');
const eventRoutes = require('./routes/events');
const teamRoutes = require('./routes/teams');

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], scriptSrc: ["'self'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"] } } }));
app.use(express.json({ limit: '20kb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/api/health', async (_req, res) => {
  try {
    const { error } = await supabase.from('hackathon_events').select('id').limit(1);
    if (error) throw error;
    res.json({ success: true, message: 'API and database are connected.' });
  } catch (_error) { res.status(503).json({ success: false, message: 'API is running, but the database connection failed. Check server configuration.' }); }
});
app.use('/api/events', eventRoutes);
app.use('/api/teams', teamRoutes);
app.get('/api/*path', (_req, res) => res.status(404).json({ success: false, message: 'API endpoint not found.' }));
app.use((err, _req, res, _next) => {
  console.error('Request failed:', err?.message || 'Unknown error');
  const status = Number(err?.status) >= 400 && Number(err?.status) < 500 ? Number(err.status) : 500;
  res.status(status).json({ success: false, message: status === 500 ? 'Something went wrong. Check the server terminal for details.' : 'Request could not be completed.' });
});
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Hackathon Portal running at http://localhost:${port}`));
