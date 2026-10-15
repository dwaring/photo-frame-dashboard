import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { googleCalendar, peopleFromTitle } from './google-calendar.js';

test('calendar OAuth boundaries, selection, pagination and event normalization', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'calendar-test-')) + '/';
  const originalFetch = globalThis.fetch;
  try {
    await writeFile(directory + 'client.json', JSON.stringify({ web: { client_id: 'test-client', client_secret: 'test-only' } }));
    await writeFile(directory + 'tokens.json', JSON.stringify({ access_token: 'test-token', expires_at: Date.now() + 3600000 }));
    await writeFile(directory + 'selection.json', JSON.stringify({ id: 'shared', name: 'Family' }));
    let handler;
    googleCalendar({ directory }).configureServer({ middlewares: { use(fn) { handler = fn; } } });
    async function request(url, headers = {}, method = 'GET', payload = '') {
      const req = { url, method, headers: { host: '127.0.0.1:5173', ...headers }, async *[Symbol.asyncIterator]() { yield payload; } };
      let body; const responseHeaders = {};
      const res = { statusCode: 200, setHeader(k, v) { responseHeaders[k] = v; }, end(value) { body = value; } };
      await handler(req, res, () => assert.fail('unexpected fallthrough'));
      return { code: res.statusCode, headers: responseHeaders, body };
    }
    assert.equal((await request('/@fs/project/.private/google-calendar/client.json')).code, 403);
    assert.equal((await request('/@fs/project/%2eprivate/google-calendar/client.json')).code, 403);
    assert.equal((await request('/api/google-calendar/status', { host: 'evil.example' })).code, 403);
    assert.equal((await request('/api/google-calendar/status', { origin: 'https://evil.example' })).code, 403);
    assert.equal((await request('/api/google-calendar/connect', { 'sec-fetch-site': 'cross-site' })).code, 403);
    assert.deepEqual(JSON.parse((await request('/api/google-calendar/status')).body), { configured: true, connected: true, selected: true });
    const auth = await request('/api/google-calendar/connect');
    assert.equal(auth.code, 302);
    const authURL = new URL(auth.headers.Location);
    assert.equal(authURL.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(authURL.searchParams.get('redirect_uri'), 'http://127.0.0.1:5173/api/google-calendar/callback');
    const state = authURL.searchParams.get('state');
    assert.equal((await request('/api/google-calendar/callback?code=bad&state=' + state, { 'sec-fetch-site': 'cross-site' })).code, 502);
    let calls = 0;
    globalThis.fetch = async url => {
      calls++;
      const second = new URL(url).searchParams.has('pageToken');
      return { ok: true, json: async () => second ? { items: [{ id: 'cancelled', status: 'cancelled', start: {}, end: {} }] } : { nextPageToken: 'next', items: [
        { id: 'allday', summary: 'Harvey — Holiday', start: { date: '2026-10-15' }, end: { date: '2026-10-17' } },
        { id: 'timed', start: { dateTime: '2026-10-15T09:00:00+10:30' }, end: { dateTime: '2026-10-15T10:00:00+10:30' } }
      ] } };
    };
    const events = JSON.parse((await request('/api/google-calendar/events')).body);
    assert.equal(calls, 2);
    assert.equal(events.events.length, 2);
    assert.equal(events.events[0].end, '2026-10-17');
    assert.equal(events.events[0].allDay, true);
    assert.deepEqual(events.events[0].people, ['harvey']);
    assert.deepEqual(events.events[1].people, ['darren', 'nadine', 'harvey', 'frankie']);
    assert.equal(events.events[1].start, '2026-10-15T09:00:00+10:30');
    assert.equal(events.events[1].title, 'Busy');
    assert.equal(JSON.stringify(events).includes('test-token'), false);
    await request('/api/google-calendar/events');
    assert.equal(calls, 2, 'successful responses are cached');
    assert.equal((await request('/api/google-calendar/select', {}, 'POST')).code, 403);
    assert.equal((await request('/api/google-calendar/select', { origin: 'null' }, 'POST')).code, 403);
    assert.equal((await request('/api/google-calendar/select', { origin: 'https://evil.example' }, 'POST')).code, 403);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ items: [{ id: 'family-test', summary: 'Family' }] }) });
    const setup = await request('/api/google-calendar/setup');
    assert.equal(setup.headers['Referrer-Policy'], 'same-origin', 'form page must preserve same-origin POST Origin');
    assert.match(setup.body, /method="post" action="\/api\/google-calendar\/select"/);
    assert.equal(auth.headers['Referrer-Policy'], 'no-referrer', 'OAuth routes still suppress referrers');
    const saved = await request('/api/google-calendar/select', { origin: 'http://127.0.0.1:5173', 'sec-fetch-site': 'same-origin' }, 'POST', 'id=family-test');
    assert.equal(saved.code, 200);
    assert.match(saved.body, /Calendar selected/);
    assert.deepEqual(JSON.parse(await readFile(directory + 'selection.json', 'utf8')), { id: 'family-test', name: 'Family' });
  } finally { globalThis.fetch = originalFetch; await rm(directory, { recursive: true, force: true }); }
});


test('event titles assign whole names, multiple people, or the whole family', () => {
  assert.deepEqual(peopleFromTitle('Harvey — Soccer'), ['harvey']);
  assert.deepEqual(peopleFromTitle('NADINE: dentist'), ['nadine']);
  assert.deepEqual(peopleFromTitle("Frankie's swimming"), ['frankie']);
  assert.deepEqual(peopleFromTitle('Frankie’s swimming'), ['frankie']);
  assert.deepEqual(peopleFromTitle('Darren + Nadine dinner with Darren'), ['darren', 'nadine']);
  const everyone = ['darren', 'nadine', 'harvey', 'frankie'];
  assert.deepEqual(peopleFromTitle('Family lunch'), everyone);
  assert.deepEqual(peopleFromTitle(), everyone);
  assert.deepEqual(peopleFromTitle('Harveyson and Frankies'), everyone);
  assert.deepEqual(peopleFromTitle('éHarvey'), everyone);
});
