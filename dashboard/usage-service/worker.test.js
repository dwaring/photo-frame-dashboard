import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../worker/chatgpt-usage.js', import.meta.url), 'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }');
const { ChatgptUsage } = await import('data:text/javascript,' + encodeURIComponent(source));

function fixture(usage) {
  const state = new Map();
  let requests = 0;
  const container = {
    running: false, images: { base: 'image' },
    start() { this.running = true; },
    async destroy() { this.running = false; },
    async setInactivityTimeout() {},
    getTcpPort() { return { async fetch(url) {
      if (url.endsWith('/health')) return Response.json({ ready: true });
      requests++;
      return Response.json({ auth: 'rotated-secret', usage });
    } }; },
  };
  const ctx = { container, storage: {
    async get(key) { return state.get(key); },
    async put(key, value) { if (typeof key === 'object') Object.entries(key).forEach(([k,v]) => state.set(k,v)); else state.set(key,value); },
    async delete(key) { state.delete(key); },
  } };
  return { service: new ChatgptUsage(ctx, { CODEX_AUTH_JSON: 'initial-secret' }), state, requests: () => requests };
}

test('container credentials persist internally while only usage is returned and cached', async () => {
  const usage = { connected: true, syncedAt: new Date().toISOString(), plan: 'plus' };
  const f = fixture(usage);
  assert.deepEqual(await f.service.usage(), usage);
  assert.equal(f.state.get('auth'), 'rotated-secret');
  assert.doesNotMatch(JSON.stringify(await f.service.usage()), /secret|auth/);
  assert.equal(f.requests(), 1);
});

test('credentials refreshed during failed usage reads survive container restart', async () => {
  const f = fixture(null);
  await assert.rejects(f.service.usage(), /Usage unavailable/);
  assert.equal(f.state.get('auth'), 'rotated-secret');
  assert.equal(f.state.has('cache'), false);
});
