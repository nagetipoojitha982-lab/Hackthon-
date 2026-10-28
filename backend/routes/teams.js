const express = require('express');
const crypto = require('node:crypto');
const supabase = require('../supabase');
const requireAdmin = require('../middleware/admin');
const { cleanText, validEmail, fail } = require('../utils/validation');
const router = express.Router();

function makeJoinCode() { return crypto.randomBytes(4).toString('hex').toUpperCase(); }

// Public summary list: never returns members' emails or team join codes.
router.get('/', async (req, res, next) => {
  try {
    const search = cleanText(req.query.search, 80);
    let query = supabase.from('teams').select('id,name,college,project_idea,lead_name,member_limit,status,created_at').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(100);
    if (search) query = query.or(`name.ilike.%${search.replace(/[,%()]/g, '')}%,college.ilike.%${search.replace(/[,%()]/g, '')}%`);
    const { data, error } = await query;
    if (error) throw error;
    const teamIds = (data || []).map(t => t.id);
    let counts = {};
    if (teamIds.length) {
      const { data: members, error: memberError } = await supabase.from('team_members').select('team_id').in('team_id', teamIds);
      if (memberError) throw memberError;
      for (const member of members || []) counts[member.team_id] = (counts[member.team_id] || 0) + 1;
    }
    res.json({ success: true, teams: (data || []).map(t => ({ ...t, member_count: counts[t.id] || 0 })) });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const name = cleanText(req.body.name, 80);
    const college = cleanText(req.body.college, 120);
    const projectIdea = cleanText(req.body.projectIdea, 500);
    const leadName = cleanText(req.body.leadName, 100);
    const leadEmail = cleanText(req.body.leadEmail, 254).toLowerCase();
    const memberLimit = Number(req.body.memberLimit || 4);
    if (!name || !college || !projectIdea || !leadName || !validEmail(leadEmail)) return fail(res, 400, 'Enter a team name, college, project idea, leader name, and valid leader email.');
    if (!Number.isInteger(memberLimit) || memberLimit < 2 || memberLimit > 6) return fail(res, 400, 'Team size must be between 2 and 6 members.');
    const { data: event, error: eventError } = await supabase.from('hackathon_events').select('registration_open').limit(1).maybeSingle();
    if (eventError) throw eventError;
    if (event && !event.registration_open) return fail(res, 403, 'Registrations are currently closed.');

    let team, insertError;
    // Retry in the extremely unlikely case that a generated code already exists.
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await supabase.from('teams').insert({ name, join_code: makeJoinCode(), college, project_idea: projectIdea, lead_name: leadName, lead_email: leadEmail, member_limit: memberLimit }).select('id,name,join_code,college,project_idea,lead_name,lead_email,member_limit,status,created_at').single();
      team = result.data; insertError = result.error;
      if (!insertError) break;
      if (insertError.code !== '23505') throw insertError;
    }
    if (insertError) throw insertError;
    const { error: memberError } = await supabase.from('team_members').insert({ team_id: team.id, full_name: leadName, email: leadEmail, role: 'lead' });
    if (memberError) {
      await supabase.from('teams').delete().eq('id', team.id);
      if (memberError.code === '23505') return fail(res, 409, 'This email is already registered on this team.');
      throw memberError;
    }
    res.status(201).json({ success: true, message: 'Team registered successfully. Save your join code.', team });
  } catch (err) { next(err); }
});

router.post('/join', async (req, res, next) => {
  try {
    const code = cleanText(req.body.joinCode, 16).toUpperCase();
    const fullName = cleanText(req.body.fullName, 100);
    const email = cleanText(req.body.email, 254).toLowerCase();
    if (!code || !fullName || !validEmail(email)) return fail(res, 400, 'Enter the team code, your full name, and a valid email.');
    const { data: team, error } = await supabase.from('teams').select('id,name,member_limit,status').eq('join_code', code).maybeSingle();
    if (error) throw error;
    if (!team || team.status === 'cancelled') return fail(res, 404, 'No active team was found for that code. Check the code and try again.');
    const { count, error: countError } = await supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('team_id', team.id);
    if (countError) throw countError;
    if (count >= team.member_limit) return fail(res, 409, 'This team is already full.');
    const { error: addError } = await supabase.from('team_members').insert({ team_id: team.id, full_name: fullName, email, role: 'member' });
    if (addError?.code === '23505') return fail(res, 409, 'This email is already registered on this team.');
    if (addError) throw addError;
    res.status(201).json({ success: true, message: `You joined ${team.name} successfully.`, team: { id: team.id, name: team.name } });
  } catch (err) { next(err); }
});

// A team detail view requires the team's join code as a simple shared secret.
router.post('/lookup', async (req, res, next) => {
  try {
    const code = cleanText(req.body.joinCode, 16).toUpperCase();
    if (!code) return fail(res, 400, 'Enter your team code.');
    const { data: team, error } = await supabase.from('teams').select('id,name,join_code,college,project_idea,lead_name,lead_email,member_limit,status,created_at').eq('join_code', code).maybeSingle();
    if (error) throw error;
    if (!team) return fail(res, 404, 'Team not found. Check your code.');
    const { data: members, error: membersError } = await supabase.from('team_members').select('id,full_name,email,role,created_at').eq('team_id', team.id).order('created_at', { ascending: true });
    if (membersError) throw membersError;
    res.json({ success: true, team, members: members || [] });
  } catch (err) { next(err); }
});

// Admin-only listing and status management.
router.get('/admin/all', requireAdmin, async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('teams').select('*,team_members(id,full_name,email,role)').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, teams: data || [] });
  } catch (err) { next(err); }
});
router.patch('/admin/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const status = cleanText(req.body.status, 20);
    if (!['registered', 'submitted', 'cancelled'].includes(status)) return fail(res, 400, 'Status must be registered, submitted, or cancelled.');
    const { data, error } = await supabase.from('teams').update({ status }).eq('id', req.params.id).select('id,name,status').maybeSingle();
    if (error) throw error;
    if (!data) return fail(res, 404, 'Team not found.');
    res.json({ success: true, team: data });
  } catch (err) { next(err); }
});
module.exports = router;
