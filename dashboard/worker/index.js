// Cloudflare Access protects the entire Worker, including its static assets.
// Calendar OAuth remains unavailable until its hosted authorization exists.
import { BOM_URL, FORECAST_URL } from '../server/bom.js';
import { todoist } from './todoist.js';
import { googlePhotos } from './google-photos.js';

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/todoist/')) return todoist(request, env);
    if (path.startsWith('/api/google-photos/')) return googlePhotos(request, env);
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    if (path === '/api/chatgpt/usage') {
      // Fail closed if Access is absent: these are personal account statistics.
      if (!request.headers.get('Cf-Access-Jwt-Assertion')) return json({ error: 'Sign-in required' }, 401);
      if (!env.CODEX_AUTH_JSON || !env.CHATGPT_USAGE) return json({ connected: false, reason: 'not-configured' });
      try {
        return json(await env.CHATGPT_USAGE.getByName('personal').usage());
      } catch {
        return json({ connected: false, reason: 'unavailable' }, 503);
      }
    }
    if (path === '/api/google-calendar/status') {
      return json({ connected: false, selected: false });
    }
    const upstream = {
      '/api/weather/observations': BOM_URL,
      '/api/weather/forecast': FORECAST_URL,
    }[path];
    if (!upstream) return json({ error: 'Hosted integration not configured' }, 503);
    try {
      const response = await fetch(upstream, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Upstream unavailable');
      const data = await response.json();
      const valid = path.endsWith('/observations')
        ? data.observations?.data?.length : data.hourly?.time?.length;
      if (!valid) throw new Error('Invalid upstream response');
      return json(data);
    } catch {
      return json({ error: 'Weather source unavailable' }, 502);
    }
  },
};
