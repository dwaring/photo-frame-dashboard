import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { googlePhotos } from '../worker/google-photos.js';
const base = 'https://dashboard.example/api/google-photos';
const headers = { 'Cf-Access-Jwt-Assertion': 'test', 'Cf-Access-Authenticated-User-Email': 'test@example.com' };
test('photo endpoints fail closed without Access', async () => {
  for (const route of ['/list', '/image/abc', '/setup', '/connect']) {
    assert.equal((await googlePhotos(new Request(base + route), {})).status, 401);
  }
});
test('unconfigured status and setup remain usable without exposing data', async () => {
  const r = await googlePhotos(new Request(base + '/status', { headers }), {});
  assert.deepEqual(await r.json(), { configured: false, connected: false, count: 0 });
  assert.equal((await googlePhotos(new Request(base + '/list', { headers }), {})).status, 503);
});
test('cross-origin import cannot write storage', async () => {
  const r = await googlePhotos(new Request(base + '/import', { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' } }), { PHOTOS: {}, GOOGLE_PHOTOS_CLIENT_ID: 'id', GOOGLE_PHOTOS_CLIENT_SECRET: 'secret' });
  assert.equal(r.status, 403);
});
test('all layouts support one landscape or portrait photo', () => {
  const App = { on() {}, photoMeta: () => ({ onThisDay: false }) };
  const DATA = { photos: [] };
  vm.runInNewContext(readFileSync(new URL('../js/slideshow.js', import.meta.url), 'utf8'), { window: { DATA }, App });
  for (const o of ['p', 'l']) for (const layout of ['auto', 'cover', 'pair', 'collage', 'polaroid']) {
    DATA.photos = [{ id: 'one', o, tag: 'import' }];
    const show = new App.Slideshow({}, { layout });
    const slide = show.pick();
    assert.ok(slide.photos.length > 0);
    assert.ok(slide.photos.every(Boolean));
  }
});
test('failed download preserves published photos; completed import publishes new selection', async () => {
  const { createHash } = await import('node:crypto');
  const key = 'auth/' + createHash('sha256').update('test@example.com').digest('hex');
  const store = new Map([['manifest', { photos: [{ id: 'old' }] }], [key, { token: 'private-token', expires: Date.now() + 60000, session: 'session', items: [{ type: 'PHOTO', createTime: '2020-01-02T00:00:00Z', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/photo', mediaFileMetadata: { width: 800, height: 1200 } } }], imported: [] }]]);
  const bucket = { async get(k) { const d = store.get(k); return d ? { json: async () => structuredClone(d) } : null; }, async put(k, d) { store.set(k, typeof d === 'string' ? JSON.parse(d) : d); }, async delete(k) { for (const id of Array.isArray(k) ? k : [k]) store.delete(id); } };
  const env = { PHOTOS: bucket, GOOGLE_PHOTOS_CLIENT_ID: 'id', GOOGLE_PHOTOS_CLIENT_SECRET: 'secret' };
  const post = (route, body) => googlePhotos(new Request(base + route, { method: 'POST', headers: { ...headers, Origin: 'https://dashboard.example', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('', { status: 502 });
    assert.equal((await post('/import', { index: 0 })).status, 400);
    assert.equal(store.get('manifest').photos[0].id, 'old');
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: 'https://other.example/image' } });
    assert.equal((await post('/import', { index: 0 })).status, 400);
    assert.equal(store.get('manifest').photos[0].id, 'old');
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('googleusercontent')) assert.equal(options.redirect, 'manual');
      assert.equal(options.headers.Authorization, 'Bearer private-token');
      return String(url).includes('googleusercontent') ? new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'image/jpeg' } }) : new Response(null, { status: 204 });
    };
    assert.equal((await post('/import', { index: 0 })).status, 200);
    assert.equal(store.get('manifest').photos[0].id, 'old');
    assert.equal((await post('/finish', {})).status, 200);
    assert.equal(store.get('manifest').photos[0].o, 'p');
    assert.equal(store.has(key), false);
    assert.equal(store.has('images/old'), false);
  } finally { globalThis.fetch = originalFetch; }
});
