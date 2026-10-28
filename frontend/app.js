const API = '/api';
const $ = (selector) => document.querySelector(selector);
let toastTimer;

function showMessage(element, message, type = '') {
  element.textContent = message;
  element.className = `form-message ${type}`.trim();
}
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('The server returned an unreadable response.'); }
  if (!response.ok || data.success === false) throw new Error(data.message || 'The request failed.');
  return data;
}
function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function initials(name) { return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase(); }
function setBusy(form, busy, label) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (busy) { button.dataset.originalText = button.textContent; button.disabled = true; button.textContent = label || 'Please wait…'; }
  else { button.disabled = false; button.textContent = button.dataset.originalText || 'Submit'; }
}

async function loadEvent() {
  try {
    const data = await api('/events');
    if (data.event) {
      $('#event-name').textContent = data.event.name;
      $('#event-description').textContent = data.event.description;
      if (data.event.registration_open === false) {
        const submit = $('#create-form button[type="submit"]');
        submit.disabled = true;
        submit.textContent = 'Registrations closed';
        $('#create-message').textContent = 'Registrations are currently closed.';
      }
    }
  } catch { $('#event-description').textContent = 'Build, collaborate, and present your ideas.'; }
}

$('#create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $('#create-message');
  showMessage(message, 'Registering your team…');
  setBusy(form, true, 'Creating team…');
  try {
    const data = await api('/teams', { method: 'POST', body: JSON.stringify(formObject(form)) });
    showMessage(message, 'Team created! Your join code is shown below. Save it and share it only with your teammates.', 'success');
    const team = data.team;
    const details = $('#team-details');
    details.hidden = false;
    details.innerHTML = `<div class="details-card"><div class="details-head"><div><span class="section-kicker">TEAM REGISTERED</span><h3>${escapeHTML(team.name)}</h3><div class="details-meta">${escapeHTML(team.college)} · Team lead: ${escapeHTML(team.lead_name)}</div></div><div class="details-code"><small>YOUR PRIVATE JOIN CODE</small>${escapeHTML(team.join_code)}</div></div><p class="details-idea">${escapeHTML(team.project_idea)}</p><p class="details-meta">Keep this code safe. Anyone with the code can view your team's member details.</p></div>`;
    details.scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.reset();
    await loadTeams();
    showToast('Your team was registered successfully.');
  } catch (error) { showMessage(message, error.message, 'error'); }
  finally { setBusy(form, false); }
});

$('#join-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $('#join-message');
  showMessage(message, 'Joining team…');
  setBusy(form, true, 'Joining…');
  const values = formObject(form);
  values.joinCode = values.joinCode.trim().toUpperCase();
  try {
    const data = await api('/teams/join', { method: 'POST', body: JSON.stringify(values) });
    showMessage(message, data.message, 'success');
    form.reset();
    await loadTeams();
    showToast(data.message);
  } catch (error) { showMessage(message, error.message, 'error'); }
  finally { setBusy(form, false); }
});

async function loadTeams() {
  const container = $('#team-list');
  container.innerHTML = '<div class="loading-state">Loading teams…</div>';
  const search = $('#team-search').value.trim();
  try {
    const data = await api(`/teams${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    if (!data.teams.length) {
      container.innerHTML = '<div class="empty-state">No teams found. Be the first to <a href="#create"><u>create a team</u></a>.</div>';
      return;
    }
    container.innerHTML = data.teams.map(team => `<article class="team-card"><div class="team-card-top"><div class="team-monogram" aria-hidden="true">${escapeHTML(initials(team.name))}</div><span class="status-pill">${escapeHTML(team.status)}</span></div><h3>${escapeHTML(team.name)}</h3><div class="team-college">${escapeHTML(team.college)}</div><p class="team-idea">${escapeHTML(team.project_idea)}</p><div class="team-card-footer"><span>Lead: ${escapeHTML(team.lead_name)}</span><span>${Number(team.member_count)}/${Number(team.member_limit)} members</span></div></article>`).join('');
  } catch (error) { container.innerHTML = `<div class="empty-state">${escapeHTML(error.message)}<br><button class="button button-outline" id="retry-teams" type="button">Try again</button></div>`; $('#retry-teams')?.addEventListener('click', loadTeams); }
}
let searchTimer;
$('#team-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadTeams, 250); });
$('#refresh-teams').addEventListener('click', loadTeams);

$('#lookup-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $('#lookup-message');
  showMessage(message, 'Looking up your team…');
  setBusy(form, true, 'Looking up…');
  const values = formObject(form);
  values.joinCode = values.joinCode.trim().toUpperCase();
  try {
    const data = await api('/teams/lookup', { method: 'POST', body: JSON.stringify(values) });
    const team = data.team;
    const details = $('#team-details');
    details.hidden = false;
    details.innerHTML = `<div class="details-card"><div class="details-head"><div><span class="section-kicker">YOUR TEAM SPACE</span><h3>${escapeHTML(team.name)}</h3><div class="details-meta">${escapeHTML(team.college)} · Lead: ${escapeHTML(team.lead_name)} · Status: ${escapeHTML(team.status)}</div></div><div class="details-code"><small>TEAM JOIN CODE</small>${escapeHTML(team.join_code)}</div></div><p class="details-idea"><strong>Project idea</strong><br>${escapeHTML(team.project_idea)}</p><div class="team-card-footer"><span>${data.members.length} registered members</span><span>Team limit: ${Number(team.member_limit)}</span></div><h4 class="members-heading">Team members</h4><div class="member-list">${data.members.map(member => `<div class="member-item"><div class="member-avatar" aria-hidden="true">${escapeHTML(initials(member.full_name))}</div><div><b>${escapeHTML(member.full_name)} ${member.role === 'lead' ? '· Lead' : ''}</b><small>${escapeHTML(member.email)}</small></div></div>`).join('')}</div></div>`;
    showMessage(message, 'Team found. Your details are displayed below.', 'success');
    details.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { showMessage(message, error.message, 'error'); }
  finally { setBusy(form, false); }
});

loadEvent();
loadTeams();
