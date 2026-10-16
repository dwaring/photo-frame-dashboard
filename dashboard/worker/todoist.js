const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export function displayTask(t) {
  const match = /\s+×([1-9]\d{0,2})$/.exec(t.content);
  return { id: t.id, name: match ? t.content.slice(0, match.index) : t.content, qty: match ? Number(match[1]) : 1,
    store: (t.labels || []).some(l => l.toLowerCase() === 'amazon') ? 'amazon' : 'grocer',
    note: t.description || '', uncompletable: !!t.is_uncompletable, recurring: !!t.due?.is_recurring };
}
export async function todoist(request, env) {
  const url = new URL(request.url);
  if (!request.headers.get('Cf-Access-Jwt-Assertion')) return json({ error: 'Dashboard sign-in required' }, 401);
  if (!env.TODOIST_API_TOKEN || !env.TODOIST_PROJECT_ID) return json({ error: 'Todoist is not connected.', connected: false }, 503);
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
  if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) return json({ error: 'Invalid origin' }, 403);
  if (url.pathname !== '/api/todoist/tasks') return json({ error: 'Unknown route' }, 404);
  async function api(path, body) {
    const r = await fetch('https://api.todoist.com/api/v1/' + path, {
      method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + env.TODOIST_API_TOKEN, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) throw Error('Todoist request failed');
    return r.status === 204 ? null : r.json();
  }
  async function list(project) {
    let cursor, tasks = [];
    do {
      const params = new URLSearchParams({ project_id: project, limit: '200' });
      if (cursor) params.set('cursor', cursor);
      const page = await api('tasks?' + params);
      tasks.push(...page.results); cursor = page.next_cursor;
    } while (cursor);
    return tasks;
  }
  try {
    if (request.method === 'GET') {
      const [tasks, staples] = await Promise.all([list(env.TODOIST_PROJECT_ID), env.TODOIST_STAPLES_PROJECT_ID ? list(env.TODOIST_STAPLES_PROJECT_ID) : []]);
      return json({ connected: true, staplesConfigured: !!env.TODOIST_STAPLES_PROJECT_ID, syncedAt: new Date().toISOString(), tasks: tasks.map(displayTask), staples: staples.filter(t => !t.is_uncompletable).map(displayTask) });
    }
    const body = await request.json();
    if (body.action === 'add' && (typeof body.name === 'string' || body.stapleId)) {
      let content = body.name?.trim(), description, labels;
      if (body.stapleId) {
        if (!env.TODOIST_STAPLES_PROJECT_ID || !/^[a-zA-Z0-9]+$/.test(body.stapleId)) return json({ error: 'Invalid staple' }, 400);
        const staple = await api('tasks/' + body.stapleId);
        if (staple.project_id !== env.TODOIST_STAPLES_PROJECT_ID || staple.is_uncompletable) return json({ error: 'Invalid staple' }, 403);
        content = staple.content; description = staple.description; labels = staple.labels;
      }
      if (!content || content.length > 500) return json({ error: 'Invalid item name' }, 400);
      // Add once. A repeated tap does not create duplicate tasks.
      const store = body.store === 'amazon' ? 'amazon' : body.store === 'grocer' ? 'grocer' : displayTask({ content, labels }).store;
      const name = displayTask({ content }).name.toLowerCase();
      const existing = (await list(env.TODOIST_PROJECT_ID)).map(displayTask).find(t => t.name.toLowerCase() === name && t.store === store);
      if (existing) return json({ ok: true, alreadyOnList: true });
      labels = (labels || []).filter(l => !['amazon', 'woolworths'].includes(l.toLowerCase()));
      if (store === 'amazon') labels.push('amazon');
      await api('tasks', { content, project_id: env.TODOIST_PROJECT_ID, ...(description ? { description } : {}), ...(labels.length ? { labels } : {}) });
    } else if (['complete', 'reopen', 'quantity'].includes(body.action) && /^[a-zA-Z0-9]+$/.test(body.id || '')) {
      const task = await api('tasks/' + body.id);
      if (task.project_id !== env.TODOIST_PROJECT_ID || task.is_uncompletable) return json({ error: 'Task is outside the shopping list or cannot be changed' }, 403);
      if (body.action === 'quantity') {
        if (!Number.isInteger(body.qty) || body.qty < 1 || body.qty > 999) return json({ error: 'Quantity must be 1–999' }, 400);
        const name = displayTask(task).name;
        await api('tasks/' + body.id, { content: name + (body.qty > 1 ? ' ×' + body.qty : '') });
      } else {
        if (body.action === 'reopen' && task.due?.is_recurring) return json({ error: 'Manage recurring task dates in Todoist' }, 400);
        await api('tasks/' + body.id + (body.action === 'complete' ? '/close' : '/reopen'), {});
      }
    } else return json({ error: 'Invalid shopping action' }, 400);
    return json({ ok: true });
  } catch { return json({ error: 'Todoist is unavailable. Refresh before trying again.' }, 502); }
}
