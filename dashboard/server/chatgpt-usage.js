import { readUsage } from '../usage-service/codex.js';
import { localCodexOptions } from './local-codex.js';

// Local development only. Hosted requests use the Cloudflare container binding.
export function chatgptUsage() {
  let cache, pending;
  function configure(server) {
    server.middlewares.use(async (req, res, next) => {
      if ((req.url || '').split('?')[0] !== '/api/chatgpt/usage') return next();
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json');
      if (req.headers['sec-fetch-site'] === 'cross-site') { res.statusCode = 403; res.end('{}'); return; }
      if (req.method !== 'GET') { res.statusCode = 405; res.end('{}'); return; }
      try {
        if (!cache || Date.now() - Date.parse(cache.syncedAt) >= 120000) {
          if (!pending) pending = localCodexOptions().then(readUsage).then(data => { cache = data; }).finally(() => { pending = null; });
          await pending;
        }
        res.end(JSON.stringify(cache));
      } catch {
        res.statusCode = 503;
        res.end(JSON.stringify({ connected: false, reason: 'local-unavailable' }));
      }
    });
  }
  return { name: 'chatgpt-usage', configureServer: configure, configurePreviewServer: configure };
}
