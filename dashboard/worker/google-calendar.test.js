import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleCalendar } from './google-calendar.js';
const origin = 'https://dashboard.example';
function fixture() {
  const data = new Map();
  const env = { GOOGLE_PHOTOS_CLIENT_ID: 'test', GOOGLE_PHOTOS_CLIENT_SECRET: 'secret', PHOTOS: { get: async key => data.has(key) ? { json: async () => JSON.parse(data.get(key)) } : null, put: async (key, value) => data.set(key, value), delete: async key => data.delete(key) } };
  const req = (path, init = {}) => new Request(origin + '/api/google-calendar/' + path, { ...init, headers: { 'Cf-Access-Jwt-Assertion': 'test', 'Cf-Access-Authenticated-User-Email': 'test@example.com', ...init.headers } });
  return { data, env, req };
}
test('Access and same-origin checks precede private storage', async () => {
  const { env, req } = fixture();
  assert.equal((await googleCalendar(new Request(origin + '/api/google-calendar/status'), env)).status, 401);
  assert.equal((await googleCalendar(req('select', { method: 'POST', headers: { Origin: 'https://other.example' } }), env)).status, 403);
});
test('OAuth uses offline access, PKCE and identity-bound state', async () => {
  const { env, req } = fixture();
  const r = await googleCalendar(req('connect'), env);
  const target = new URL(r.headers.get('Location'));
  assert.equal(target.searchParams.get('access_type'), 'offline');
  assert.equal(target.searchParams.get('code_challenge_method'), 'S256');
  const state = target.searchParams.get('state');
  const invalid = await googleCalendar(req('callback?state=' + state + '&code=test', { headers: { Cookie: 'calendar_state=' + state, 'Cf-Access-Authenticated-User-Email': 'other@example.com' } }), env);
  assert.match(await invalid.text(), /Authorization expired/);
});
test('refreshes tokens privately and normalizes paginated all-day and timed events', async () => {
  const { env, req, data } = fixture();
  data.set('calendar/connection', JSON.stringify({ access_token: 'old', refresh_token: 'refresh', expires: 0, selected: { id: 'shared', name: 'Family' } }));
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes('oauth2.googleapis.com')) {
      assert.equal(init.body.get('refresh_token'), 'refresh');
      return Response.json({ access_token: 'new', expires_in: 3600 });
    }
    assert.equal(init.headers.Authorization, 'Bearer new');
    if (String(url).includes('pageToken=')) return Response.json({ items: [{ id: '2', summary: 'Family', start: { dateTime: '2026-10-18T09:00:00+10:30' }, end: { dateTime: '2026-10-18T10:00:00+10:30' } }] });
    return Response.json({ nextPageToken: 'next', items: [{ id: '1', summary: 'Harvey’s birthday', start: { date: '2026-10-18' }, end: { date: '2026-10-19' } }, { status: 'cancelled' }] });
  };
  try {
    const r = await googleCalendar(req('events'), env), body = await r.json();
    assert.equal(r.status, 200);
    assert.equal(body.events.length, 2);
    assert.deepEqual(body.events[0].people, ['harvey']);
    assert.equal(body.events[0].end, '2026-10-19');
    assert.equal(body.events[0].allDay, true);
    assert.equal(body.events[1].people.length, 4);
    assert.equal(calls.length, 3);
    assert.equal(JSON.parse(data.get('calendar/connection')).refresh_token, 'refresh');
    assert.ok(!JSON.stringify(body).includes('refresh_token'));
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
  } finally { globalThis.fetch = original; }
});
