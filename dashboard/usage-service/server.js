import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readUsage } from './codex.js';

const key = process.env.USAGE_SERVICE_KEY;
if (!key || key.length < 32) throw new Error('Usage service key missing');
const authPath = process.env.CODEX_HOME + '/auth.json';
if (process.env.CODEX_AUTH_JSON) {
  JSON.parse(process.env.CODEX_AUTH_JSON);
  await mkdir(process.env.CODEX_HOME, { recursive: true, mode: 0o700 });
  await writeFile(authPath, process.env.CODEX_AUTH_JSON, { mode: 0o600 });
  delete process.env.CODEX_AUTH_JSON;
}
const digest = value => createHash('sha256').update(value).digest();
let cache, pending;
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  const reply = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
  if (req.method === 'GET' && req.url === '/health') return reply(200, { ready: true });
  if (req.method !== 'GET' || req.url !== '/internal/snapshot') return reply(404, { error: 'Not found' });
  if (!timingSafeEqual(digest(req.headers.authorization || ''), digest('Bearer ' + key))) return reply(401, { error: 'Unauthorized' });
  try {
    if (!cache || Date.now() - Date.parse(cache.syncedAt) >= 120000) {
      if (!pending) pending = readUsage().then(data => { cache = data; }).finally(() => { pending = null; });
      await pending;
    }
    // Internal transport only: the Durable Object persists rotated credentials and
    // returns only `usage` to the Worker. This route has no public ingress.
    reply(200, { usage: cache, auth: await readFile(authPath, 'utf8') });
  } catch {
    // A failed API request may still have refreshed credentials. Preserve them
    // through the internal channel so a restart cannot reuse an old refresh token.
    try { reply(200, { usage: null, auth: await readFile(authPath, 'utf8') }); }
    catch { reply(503, { connected: false }); }
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(Number(process.env.PORT || 8788), process.env.USAGE_BIND || '127.0.0.1');
