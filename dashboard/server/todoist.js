import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { todoist } from '../worker/todoist.js';

const privateRoot = new URL('../../.private/', import.meta.url);
async function credentials() {
  const [token, config] = await Promise.all([
    readFile(new URL('todoist-token', privateRoot), 'utf8'),
    readFile(new URL('todoist.json', privateRoot), 'utf8').then(JSON.parse)
  ]);
  return { TODOIST_API_TOKEN: token.trim(), TODOIST_PROJECT_ID: config.shoppingProjectId, TODOIST_STAPLES_PROJECT_ID: config.usualsProjectId };
}

// Reuse the hosted adapter only after enforcing local request boundaries.
export function localTodoistMiddleware(loadCredentials = credentials, handle = todoist) {
  return async (req, res, next) => {
    if ((req.url || '').split('?')[0] !== '/api/todoist/tasks') return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const reject = (status, error) => { res.statusCode = status; res.end(JSON.stringify({ error })); };
    const address = req.socket.remoteAddress;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return reject(403, 'Local requests only');
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)) return reject(403, 'Invalid local host');
    const origin = 'http://' + host;
    if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== origin)) return reject(403, 'Invalid origin');
    if (!['GET', 'POST'].includes(req.method)) return reject(405, 'Method not allowed');
    if (req.method === 'POST' && req.headers.origin !== origin) return reject(403, 'Invalid origin');
    try {
      const env = await loadCredentials();
      let body;
      if (req.method === 'POST') {
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += Buffer.byteLength(chunk);
          if (size > 8192) return reject(413, 'Request too large');
          chunks.push(Buffer.from(chunk));
        }
        body = Buffer.concat(chunks).toString('utf8');
        try { JSON.parse(body); } catch { return reject(400, 'Invalid JSON'); }
      }
      const headers = { 'Cf-Access-Jwt-Assertion': 'local-development', ...(req.method === 'POST' ? { Origin: origin } : {}) };
      const response = await handle(new Request(origin + '/api/todoist/tasks', { method: req.method, headers, body }), env);
      res.statusCode = response.status;
      res.end(await response.text());
    } catch { reject(503, 'Local Todoist setup unavailable. Check .private/todoist-token and .private/todoist.json.'); }
  };
}
export function localTodoist() {
  function configure(server) {
    server.middlewares.use(localTodoistMiddleware());
    // Credential changes are read per request and must never be served as assets.
    server.watcher?.unwatch(fileURLToPath(privateRoot));
  }
  return { name: 'local-todoist', configureServer: configure, configurePreviewServer: configure };
}
