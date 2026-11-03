import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('calendar uses Access credentials, reports reconnect, retains stale events and clears disconnected data', async () => {
  const data = { events: [] };
  let boot, mode = 'live';
  const app = { emit() {}, rerender() {} };
  const window = { DATA: data, App: app, addEventListener() {} };
  const context = {
    window, Date, AbortSignal,
    setTimeout(fn) { boot = fn; }, setInterval() {},
    fetch: async (url, options) => {
      assert.equal(options.credentials, 'same-origin');
      assert.equal(options.cache, 'no-store');
      if (url.endsWith('/status')) return Response.json({ configured: true, connected: mode !== 'disconnected', selected: mode !== 'disconnected' });
      if (mode === 'reconnect') return Response.json({ code: 'reauthorization-required' }, { status: 502 });
      return Response.json({ syncedAt: Date.now(), events: [{ id: 'a', title: 'Test', allDay: true, start: '2026-11-03', end: '2026-11-04' }] });
    }
  };
  vm.runInNewContext(await readFile(new URL('../js/google-calendar.js', import.meta.url), 'utf8'), context);
  await boot();
  assert.equal(data.calendar.state, 'synced');
  assert.equal(data.events[0].start.getHours(), 0);
  const event = data.events[0];
  mode = 'reconnect'; await app.syncCalendar();
  assert.equal(data.calendar.state, 'reconnect');
  assert.equal(data.calendar.setupRequired, true);
  assert.equal(data.events[0], event);
  mode = 'disconnected'; await app.syncCalendar();
  assert.equal(data.calendar.state, 'not-connected');
  assert.equal(data.events.length, 0);
});
