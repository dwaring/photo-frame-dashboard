// Shared household calendar. Credentials remain in private R2, behind Cloudflare Access.
const root = '/api/google-calendar';
const prefix = 'calendar/';
const scopes = ['calendar.calendarlist.readonly', 'calendar.events.readonly'].map(s => 'https://www.googleapis.com/auth/' + s).join(' ');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };
const json = (body, status = 200) => Response.json(body, { status, headers });
const cookie = (state, age = 600) => 'calendar_state=' + state + '; Secure; HttpOnly; SameSite=Lax; Path=' + root + '; Max-Age=' + age;
const redirect = (location, value) => new Response(null, { status: 303, headers: { ...headers, Location: location, ...(value ? { 'Set-Cookie': value } : {}) } });
const page = body => new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Google Calendar setup</title><style>body{font:18px system-ui;max-width:720px;margin:40px auto;padding:24px}label{display:block;margin:16px 0}button,a{display:inline-block;padding:12px;margin:8px 0}</style><h1>Shared Google Calendar</h1>' + body + '<p><a href="/">Back to dashboard</a></p>', { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" } });
function people(title = '') {
  const names = ['darren', 'nadine', 'harvey', 'frankie'];
  const matched = names.filter(n => new RegExp('(^|[^\\p{L}\\p{N}_])' + n + '(?=$|[^\\p{L}\\p{N}_])', 'iu').test(title));
  return matched.length ? matched : names;
}
export async function googleCalendar(request, env) {
  const url = new URL(request.url), route = url.pathname.slice(root.length);
  const identity = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (!request.headers.get('Cf-Access-Jwt-Assertion') || !identity) return json({ error: 'Dashboard sign-in required' }, 401);
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
  if ((request.method === 'POST' && request.headers.get('Origin') !== url.origin) || (route !== '/callback' && request.headers.get('Sec-Fetch-Site') === 'cross-site')) return json({ error: 'Invalid origin' }, 403);
  const clientId = env.GOOGLE_CALENDAR_CLIENT_ID || env.GOOGLE_PHOTOS_CLIENT_ID;
  const clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET || env.GOOGLE_PHOTOS_CLIENT_SECRET;
  const bucket = env.PHOTOS, configured = !!(bucket && clientId && clientSecret);
  const read = async key => { const object = await bucket.get(prefix + key); return object ? object.json() : null; };
  const save = (key, data) => bucket.put(prefix + key, JSON.stringify(data));
  const callback = url.origin + root + '/callback';
  async function exchange(params, previous = {}) {
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw Error('Google authorization failed. Reconnect your Google account.');
    const t = await r.json();
    if (!t.access_token || !(t.refresh_token || previous.refresh_token)) throw Error('Offline authorization missing. Reconnect your Google account.');
    return { access_token: t.access_token, refresh_token: t.refresh_token || previous.refresh_token, expires: Date.now() + t.expires_in * 1000 };
  }
  let auth;
  async function api(path, query = {}) {
    if (!auth) auth = await read('connection');
    if (!auth?.access_token) throw Error('Connect your Google account first.');
    if (auth.expires < Date.now() + 60000) {
      auth = { ...auth, ...await exchange({ grant_type: 'refresh_token', refresh_token: auth.refresh_token }, auth) };
      await save('connection', auth);
    }
    const r = await fetch('https://www.googleapis.com/calendar/v3/' + path + '?' + new URLSearchParams(query), { headers: { Authorization: 'Bearer ' + auth.access_token }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw Error('Google Calendar request failed. Reconnect or try again.');
    return r.json();
  }
  async function pages(path, query) {
    const items = []; let next;
    do { const data = await api(path, { ...query, ...(next ? { pageToken: next } : {}) }); items.push(...(data.items || [])); next = data.nextPageToken; } while (next);
    return items;
  }
  try {
    if (route === '/status' && request.method === 'GET') {
      const connection = configured && await read('connection');
      return json({ configured, connected: !!connection?.access_token, selected: !!connection?.selected?.id });
    }
    if (!configured) return page('<p>Hosted Calendar credentials are missing. See docs/google-calendar.md.</p>');
    if (route === '/connect' && request.method === 'GET') {
      const state = crypto.randomUUID(), verifier = crypto.randomUUID() + crypto.randomUUID();
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
      const challenge = btoa(String.fromCharCode(...hash)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      await save('oauth/' + state, { identity, verifier, expires: Date.now() + 600000 });
      return redirect('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: clientId, redirect_uri: callback, response_type: 'code', scope: scopes, access_type: 'offline', prompt: 'consent', state, code_challenge: challenge, code_challenge_method: 'S256' }), cookie(state));
    }
    if (route === '/callback' && request.method === 'GET') {
      const state = url.searchParams.get('state');
      if (!/^[a-f0-9-]{36}$/.test(state || '')) throw Error('Authorization expired. Connect again.');
      const attempt = await read('oauth/' + state);
      if (!attempt || attempt.identity !== identity || attempt.expires < Date.now() || !request.headers.get('Cookie')?.split(';').some(c => c.trim() === 'calendar_state=' + state)) throw Error('Authorization expired. Connect again.');
      await bucket.delete(prefix + 'oauth/' + state);
      if (!url.searchParams.get('code')) throw Error('Google authorization cancelled.');
      const token = await exchange({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: callback, code_verifier: attempt.verifier });
      // A new account must explicitly choose its calendar; replace connection atomically.
      await save('connection', token);
      return redirect(root + '/setup', cookie('', 0));
    }
    if (route === '/setup' && request.method === 'GET') {
      auth = await read('connection');
      if (!auth) return page('<p>Connect a Google account to display one shared calendar. Google events are read-only.</p><a href="' + root + '/connect">Connect Google account</a>');
      const calendars = await pages('users/me/calendarList', { minAccessRole: 'reader' });
      return page('<p>Choose the shared household calendar. This selection applies to everyone using the dashboard.</p><form method="post" action="' + root + '/select">' + calendars.map(c => '<label><input type="radio" required name="id" value="' + esc(c.id) + '"' + (auth.selected?.id === c.id ? ' checked' : '') + '>' + esc(c.summaryOverride || c.summary || c.id) + '</label>').join('') + '<button>Use selected calendar</button></form><a href="' + root + '/connect">Reconnect Google account</a>');
    }
    if (route === '/select' && request.method === 'POST') {
      const body = await request.text();
      if (body.length > 8192) return json({ error: 'Request too large' }, 413);
      const id = new URLSearchParams(body).get('id');
      const calendars = await pages('users/me/calendarList', { minAccessRole: 'reader' });
      const selected = calendars.find(c => c.id === id);
      if (!selected) throw Error('Choose an available calendar.');
      await save('connection', { ...auth, selected: { id, name: selected.summaryOverride || selected.summary || id } });
      return page('<p>Calendar selected. Return to the dashboard to sync events.</p>');
    }
    if (route === '/events' && request.method === 'GET') {
      auth = await read('connection');
      if (!auth?.selected) return json({ error: 'Select a calendar first.' }, 409);
      const selected = auth.selected;
      const items = await pages('calendars/' + encodeURIComponent(selected.id) + '/events', { singleEvents: 'true', orderBy: 'startTime', timeMin: new Date(Date.now() - 366 * 86400000).toISOString(), timeMax: new Date(Date.now() + 366 * 86400000).toISOString(), maxResults: '2500' });
      return json({ name: selected.name, syncedAt: Date.now(), events: items.filter(e => e.status !== 'cancelled' && e.start && e.end).map(e => ({ id: 'google-' + e.id, title: e.summary || 'Busy', start: e.start.dateTime || e.start.date, end: e.end.dateTime || e.end.date, allDay: !!e.start.date, loc: e.location || '', people: people(e.summary), source: 'google' })) });
    }
    return json({ error: 'Unknown calendar route' }, 404);
  } catch (e) {
    if (route === '/status' || route === '/events') return json({ error: e.message }, 502);
    return page('<p>' + esc(e.message) + '</p><a href="' + root + '/connect">Reconnect Google account</a><p><a href="' + root + '/setup">Calendar setup</a></p>');
  }
}
