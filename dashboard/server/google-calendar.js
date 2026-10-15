import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const defaultDirectory = fileURLToPath(new URL('../../.private/google-calendar/', import.meta.url));
const scopes = ['calendar.calendarlist.readonly', 'calendar.events.readonly'].map(s => 'https://www.googleapis.com/auth/' + s).join(' ');
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const familyMembers = ['darren', 'nadine', 'harvey', 'frankie'];

// Whole names only, including punctuation and possessives (e.g. “Frankie’s”).
export function peopleFromTitle(title = '') {
  const matched = familyMembers.filter(name =>
    new RegExp('(^|[^\\p{L}\\p{N}_])' + name + '(?=$|[^\\p{L}\\p{N}_])', 'iu').test(title)
  );
  return matched.length ? matched : familyMembers.slice();
}

export function googleCalendar({ directory = defaultDirectory } = {}) {
async function read(name, fallback) {
  try { return JSON.parse(await readFile(directory + name, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
async function save(name, value) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(directory + name, JSON.stringify(value), { mode: 0o600 });
}

  const attempts = new Map();
  let cache;
  async function client() {
    const data = await read('client.json', {});
    return data.web || data.installed;
  }
  async function tokens(params) {
    const c = await client();
    if (!c?.client_id || !c.client_secret) throw new Error('OAuth client missing');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', body: new URLSearchParams({ client_id: c.client_id, client_secret: c.client_secret, ...params }), signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('Google authorization failed. Reconnect your account.');
    const data = await response.json();
    const previous = await read('tokens.json', {});
    const result = { ...previous, ...data, expires_at: Date.now() + data.expires_in * 1000 };
    await save('tokens.json', result);
    return result;
  }
  async function api(path, query = {}) {
    let token = await read('tokens.json', {});
    if (!token.access_token) throw new Error('Connect your Google account first.');
    if (Date.now() >= token.expires_at - 60000) token = await tokens({ grant_type: 'refresh_token', refresh_token: token.refresh_token });
    const response = await fetch('https://www.googleapis.com/calendar/v3/' + path + '?' + new URLSearchParams(query), {
      headers: { Authorization: 'Bearer ' + token.access_token }, signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('Google Calendar unavailable. Check access or reconnect.');
    return response.json();
  }
  async function pages(path, query) {
    const items = []; let pageToken;
    do { const page = await api(path, { ...query, ...(pageToken ? { pageToken } : {}) }); items.push(...(page.items || [])); pageToken = page.nextPageToken; } while (pageToken);
    return items;
  }
  function configure(server) {
    server.middlewares.use(async (req, res, next) => {
      let requestPath;
      try { requestPath = decodeURIComponent((req.url || '').split('?')[0]); }
      catch { res.statusCode = 400; return res.end('Invalid URL'); }
      if (requestPath.split('/').includes('.private')) { res.statusCode = 403; return res.end('Forbidden'); }
      if (!req.url?.startsWith('/api/google-calendar')) return next();
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      const host = req.headers.host || '';
      if (!/^127\.0\.0\.1:\d+$/.test(host)) { res.statusCode = 403; return res.end('Use http://127.0.0.1:5173'); }
      const origin = 'http://' + host;
      if ((req.headers.origin && req.headers.origin !== origin) || (req.headers['sec-fetch-site'] === 'cross-site' && !req.url.startsWith('/api/google-calendar/callback?'))) { res.statusCode = 403; return res.end('Forbidden'); }
      const url = new URL(req.url, origin);
      const route = url.pathname.slice('/api/google-calendar'.length);
      const redirect = origin + '/api/google-calendar/callback';
      const json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
      const page = body => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"); res.end('<!doctype html><meta charset="utf-8"><title>Google Calendar setup</title><style>body{font:18px system-ui;max-width:720px;margin:60px auto;padding:24px;background:#f2eee6;color:#222}button,a{display:inline-block;margin:12px 0;padding:12px}label{display:block;margin:16px 0}</style><h1>Shared Google Calendar</h1>' + body + '<p><a href="/">Back to dashboard</a></p>'); };
      try {
        if (req.method === 'GET' && route === '/status') return json({ configured: !!(await client()), connected: !!(await read('tokens.json', {})).access_token, selected: !!(await read('selection.json', {})).id });
        if (req.method === 'GET' && route === '/connect') {
          if (!(await client())) return page('<p>First save your downloaded Google OAuth client JSON as <code>.private/google-calendar/client.json</code> in the project folder. See <code>docs/google-calendar.md</code> for setup.</p>');
          for (const [key, value] of attempts) if (value.expires < Date.now()) attempts.delete(key);
          const state = randomBytes(32).toString('hex'), verifier = randomBytes(32).toString('base64url');
          attempts.set(state, { verifier, expires: Date.now() + 600000 });
          res.setHeader('Set-Cookie', 'calendar_state=' + state + '; HttpOnly; SameSite=Lax; Path=/api/google-calendar; Max-Age=600');
          const query = new URLSearchParams({ client_id: (await client()).client_id, redirect_uri: redirect, response_type: 'code', scope: scopes, access_type: 'offline', prompt: 'consent', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
          res.statusCode = 302; res.setHeader('Location', 'https://accounts.google.com/o/oauth2/v2/auth?' + query); return res.end();
        }
        if (req.method === 'GET' && route === '/callback') {
          const state = url.searchParams.get('state'), attempt = attempts.get(state);
          if (!attempt || attempt.expires < Date.now() || !req.headers.cookie?.split('; ').includes('calendar_state=' + state)) throw new Error('Authorization expired. Start again.');
          attempts.delete(state);
          res.setHeader('Set-Cookie', 'calendar_state=; HttpOnly; SameSite=Lax; Path=/api/google-calendar; Max-Age=0');
          if (!url.searchParams.get('code')) throw new Error('Google authorization was cancelled.');
          await tokens({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: redirect, code_verifier: attempt.verifier });
          res.statusCode = 302; res.setHeader('Location', '/api/google-calendar/setup'); return res.end();
        }
        if (req.method === 'GET' && route === '/setup') {
          // Basic form POSTs need a real Origin for the selection endpoint's CSRF check.
          // Keep no-referrer on OAuth routes; reveal setup referrers only locally.
          res.setHeader('Referrer-Policy', 'same-origin');
          if (!(await read('tokens.json', {})).access_token) return page('<p>Read-only access: choose which shared calendar to display after signing in.</p><a href="/api/google-calendar/connect">Connect Google account</a>');
          const calendars = await pages('users/me/calendarList', { minAccessRole: 'reader' });
          const selected = await read('selection.json', {});
          return page('<p>Select your shared calendar. Events will populate the dashboard calendar. Google events are read-only.</p><form method="post" action="/api/google-calendar/select">' + calendars.map(c => '<label><input type="radio" required name="id" value="' + escape(c.id) + '"' + (c.id === selected.id ? ' checked' : '') + '> ' + escape(c.summaryOverride || c.summary || c.id) + '</label>').join('') + '<button>Use selected calendar</button></form><a href="/api/google-calendar/connect">Reconnect Google account</a>');
        }
        if (req.method === 'POST' && route === '/select') {
          if (req.headers.origin !== origin) { res.statusCode = 403; return res.end('Forbidden'); }
          let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 8192) throw new Error('Request too large'); }
          const id = new URLSearchParams(body).get('id');
          const calendars = await pages('users/me/calendarList', { minAccessRole: 'reader' });
          const selected = calendars.find(c => c.id === id);
          if (!selected) throw new Error('Choose an available calendar.');
          await save('selection.json', { id, name: selected.summaryOverride || selected.summary }); cache = undefined;
          return page('<p>Calendar selected. Return to the dashboard to load your events.</p>');
        }
        if (req.method === 'GET' && route === '/events') {
          const selected = await read('selection.json', {});
          if (!selected.id) { res.statusCode = 409; return json({ error: 'Select a calendar first.' }); }
          if (!cache || Date.now() - cache.syncedAt > 60000) {
            const start = new Date(); start.setDate(start.getDate() - 366);
            const end = new Date(); end.setDate(end.getDate() + 366);
            const items = await pages('calendars/' + encodeURIComponent(selected.id) + '/events', { singleEvents: 'true', orderBy: 'startTime', timeMin: start.toISOString(), timeMax: end.toISOString(), maxResults: '2500' });
            cache = { name: selected.name, syncedAt: Date.now(), events: items.filter(e => e.status !== 'cancelled' && e.start && e.end).map(e => ({ id: 'google-' + e.id, title: e.summary || 'Busy', start: e.start.dateTime || e.start.date, end: e.end.dateTime || e.end.date, allDay: !!e.start.date, loc: e.location || '', people: peopleFromTitle(e.summary), source: 'google' })) };
          }
          return json(cache);
        }
        res.statusCode = 404; json({ error: 'Unknown calendar route' });
      } catch (error) { res.statusCode = 502; if (route === '/events' || route === '/status') json({ error: 'Calendar sync failed. Reconnect or try again.' }); else page('<p>' + escape(error.message) + '</p><a href="/api/google-calendar/setup">Calendar setup</a>'); }
    });
  }
  return { name: 'google-calendar', configureServer: configure, configurePreviewServer: configure };
}
