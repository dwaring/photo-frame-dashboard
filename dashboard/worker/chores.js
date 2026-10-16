import { readHistory, writeCompletion } from './chore-history.js';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const people = ['darren', 'nadine', 'harvey', 'frankie', 'any'];
const slots = ['morning', 'after', 'evening'];
const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export function displayChore(task) {
  const labels = task.labels || [];
  const who = people.filter(p => labels.includes('person_' + p));
  const slot = slots.filter(p => labels.includes('slot_' + p));
  const scheduled = days.filter(p => labels.includes('day_' + p));
  if (task.is_uncompletable || !who.length || (who.includes('any') && who.length > 1) || !slot.length || !scheduled.length) return null;
  return { trackingSince: (task.added_at || task.created_at || new Date().toISOString()).slice(0, 10), id: task.id, title: task.content, people: who, slots: slot, days: scheduled, emoji: '✓', completions: {} };
}
export async function choreRoute(request, env) {
  const url = new URL(request.url);
  if (!request.headers.get('Cf-Access-Jwt-Assertion')) return json({ error: 'Dashboard sign-in required' }, 401);
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
  if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) return json({ error: 'Invalid origin' }, 403);
  if (!env.TODOIST_API_TOKEN || !env.TODOIST_CHORES_PROJECT_ID) return json({ error: 'Chores project is not connected.' }, 503);
  async function api(path, body) {
    const response = await fetch('https://api.todoist.com/api/v1/' + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + env.TODOIST_API_TOKEN, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error('Todoist request failed');
    return response.status === 204 ? null : response.json();
  }
  try {
    const bucket = env.CHORE_HISTORY || env.PHOTOS;
    if (!bucket) return json({ error: 'Chore completion storage is not configured.' }, 503);
    if (request.method === 'GET') {
      let cursor, tasks = [];
      do {
        const params = new URLSearchParams({ project_id: env.TODOIST_CHORES_PROJECT_ID, limit: '200' });
        if (cursor) params.set('cursor', cursor);
        const page = await api('tasks?' + params); tasks.push(...page.results); cursor = page.next_cursor;
      } while (cursor);
      const chores = tasks.map(displayChore).filter(Boolean);
      const history = await readHistory(bucket, env.TODOIST_CHORES_PROJECT_ID);
      const byId = new Map(chores.map(c => [c.id, c]));
      for (const hit of history) {
        const chore = byId.get(hit.task);
        if (chore) {
          chore.completions[hit.date] ||= {};
          chore.completions[hit.date][hit.slot || chore.slots[0]] ||= {};
          chore.completions[hit.date][hit.slot || chore.slots[0]][hit.person] = { by: hit.by };
        }
      }
      return json({ chores, unmapped: tasks.length - chores.length, syncedAt: new Date().toISOString() });
    }
    const body = await request.json();
    if (!['save', 'complete', 'reopen'].includes(body.action)) return json({ error: 'Invalid chore action' }, 400);
    let task;
    if (body.id) {
      if (!/^[a-zA-Z0-9]+$/.test(body.id)) return json({ error: 'Invalid chore ID' }, 400);
      task = await api('tasks/' + body.id);
      if (task.project_id !== env.TODOIST_CHORES_PROJECT_ID || task.is_uncompletable) return json({ error: 'Task is outside Chores' }, 403);
    } else if (body.action !== 'save') return json({ error: 'Chore ID required' }, 400);
    let update = {};
    if (body.action === 'save') {
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 500 || !Array.isArray(body.people) || !body.people.length || body.people.some(p => !people.includes(p)) || (body.people.includes('any') && body.people.length > 1) || !Array.isArray(body.slots) || !body.slots.length || body.slots.some(s => !slots.includes(s)) || !Array.isArray(body.days) || !body.days.length || body.days.some(d => !days.includes(d))) return json({ error: 'Choose a title, family members, timeslots and days. Anyone must be selected alone.' }, 400);
      update = { content: body.title.trim(), labels: [...(task?.labels || []).filter(l => !/^(person_|slot_|day_)/.test(l)), ...[...new Set(body.people)].map(p => 'person_' + p), ...[...new Set(body.slots)].map(s => 'slot_' + s), ...[...new Set(body.days)].map(d => 'day_' + d)] };

    } else {
      const chore = displayChore(task);
      const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? new Date(body.date + 'T00:00:00Z') : null;
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      if (!date || isNaN(date) || date.toISOString().slice(0, 10) !== body.date || body.date > today || !chore || !chore.slots.includes(body.r) || !chore.days.includes(days[(date.getUTCDay() + 6) % 7]) || !people.includes(body.by) || body.by === 'any' || !chore.people.includes(body.person) || (body.person !== 'any' && body.by !== body.person)) return json({ error: 'Invalid completion date or family member' }, 400);
      await writeCompletion(bucket, env.TODOIST_CHORES_PROJECT_ID, body);
      return json({ ok: true });
    }
    await api(task ? 'tasks/' + task.id : 'tasks', task ? update : { ...update, project_id: env.TODOIST_CHORES_PROJECT_ID });
    return json({ ok: true });
  } catch { return json({ error: 'Chores sync failed. Refresh before trying again.' }, 502); }
}
