const express = require('express');
const supabase = require('../supabase');
const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('hackathon_events')
      .select('id,name,description,event_date,registration_open').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    res.json({ success: true, event: data || null });
  } catch (err) { next(err); }
});
module.exports = router;
