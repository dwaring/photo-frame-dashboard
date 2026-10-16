import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { localTodoistMiddleware } from './todoist.js';
async function run({ method = 'GET', host = '127.0.0.1:5173', address = '127.0.0.1', origin, site, body } = {}, load = async () => ({ TODOIST_API_TOKEN: 'private-token' })) {
  let called = false;
  const req = Readable.from(body ? [body] : []);
  Object.assign(req, { url: '/api/todoist/tasks', method, socket: { remoteAddress: address }, headers: { host, ...(origin ? { origin } : {}), ...(site ? { 'sec-fetch-site': site } : {}) } });
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } };
  const middleware = localTodoistMiddleware(load, async (request, env) => {
    called = true; assert.equal(env.TODOIST_API_TOKEN, 'private-token');
    assert.equal(request.headers.get('Cf-Access-Jwt-Assertion'), 'local-development');
    if (method === 'POST') assert.equal((await request.json()).action, 'add');
    return Response.json({ connected: true, tasks: [], staples: [] });
  });
  await middleware(req, res, () => assert.fail('Unexpected fallthrough'));
  return { ...res, called };
}
test('local reads and same-origin writes reach the shared adapter without returning the token', async () => {
  for (const options of [{}, { method: 'POST', origin: 'http://127.0.0.1:5173', body: '{"action":"add"}' }]) {
    const res = await run(options); assert.equal(res.statusCode, 200); assert.ok(res.called);
    assert.ok(!res.body.includes('private-token')); assert.equal(res.headers['Cache-Control'], 'no-store');
  }
});
test('rejects remote peers, rebinding hosts, and cross-origin reads and writes before credential loading', async () => {
  const noLoad = async () => assert.fail('Credentials must not be read');
  for (const options of [{ address: '192.168.1.2' }, { host: 'attacker.example:5173' }, { origin: 'https://attacker.example' }, { site: 'cross-site' }, { method: 'POST', body: '{}' }]) {
    const res = await run(options, noLoad); assert.equal(res.statusCode, 403); assert.equal(res.called, false);
  }
});
test('missing credentials produces a clear setup message without exposing errors', async () => {
  const res = await run({}, async () => { throw Error('private-token'); });
  assert.equal(res.statusCode, 503); assert.ok(res.body.includes('.private/todoist-token')); assert.ok(!res.body.includes('private-token'));
});
test('rejects malformed and oversized writes', async () => {
  for (const [body, status] of [['{', 400], ['x'.repeat(9000), 413]]) {
    const res = await run({ method: 'POST', origin: 'http://127.0.0.1:5173', body });
    assert.equal(res.statusCode, status); assert.equal(res.called, false);
  }
});
