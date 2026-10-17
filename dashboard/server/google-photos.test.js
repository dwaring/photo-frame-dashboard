import test from 'node:test';
import assert from 'node:assert/strict';
import { localPhotos } from './google-photos.js';

test('local photos reject cross-site requests and unsupported methods', async () => {
  let handle;
  localPhotos().configureServer({ middlewares: { use(fn) { handle = fn; } } });
  for (const request of [
    { method: 'GET', headers: { host: 'example.com' } },
    { method: 'GET', headers: { host: '127.0.0.1:5173', 'sec-fetch-site': 'cross-site' } },
    { method: 'GET', headers: { host: '127.0.0.1:5173', origin: 'https://example.com' } },
    { method: 'POST', headers: { host: '127.0.0.1:5173' } }
  ]) {
    const res = { setHeader() {}, end() {} };
    await handle({ url: '/api/google-photos/list', ...request }, res, () => assert.fail('Unexpected fallthrough'));
    assert.equal(res.statusCode, request.method === 'POST' ? 405 : 403);
  }
});
