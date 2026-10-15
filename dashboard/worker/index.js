// Cloudflare Access protects the entire Worker, including its static assets.
// OAuth integrations are deliberately unavailable until hosted authorization exists.
import { BOM_URL, FORECAST_URL } from '../server/bom.js';

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
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
