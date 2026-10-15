// Fixed upstream and route: this is not a general-purpose proxy.
export const BOM_URL = 'https://reg.bom.gov.au/fwo/IDS60901/IDS60901.94648.json';
export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast?latitude=-34.9285&longitude=138.6007&timezone=Australia%2FAdelaide&timeformat=unixtime&forecast_days=2&hourly=temperature_2m,precipitation_probability,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min';
export function bomObservations() {
  const forecast = createRoute(FORECAST_URL, data => !!data.hourly?.time?.length);
  let cache;
  let pending;
  async function load() {
    if (cache && Date.now() - cache.at < 5 * 60000) return cache.data;
    if (!pending) pending = (async () => {
      const response = await fetch(BOM_URL, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('BoM unavailable');
      const data = await response.json();
      if (!data.observations?.data?.length) throw new Error('Invalid BoM response');
      cache = { at: Date.now(), data };
      return data;
    })().finally(() => { pending = undefined; });
    return pending;
  }
  function configure(server) {
    server.middlewares.use('/api/weather/forecast', forecast);
    server.middlewares.use('/api/weather/observations', async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      if (req.method !== 'GET') { res.statusCode = 405; res.end('{}'); return; }
      try { res.end(JSON.stringify(await load())); }
      catch { res.statusCode = 502; res.end(JSON.stringify({ error: 'BoM observations unavailable' })); }
    });
  }
  return { name: 'bom-observations', configureServer: configure, configurePreviewServer: configure };
}

function createRoute(url, valid) {
  let cache;
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') { res.statusCode = 405; res.end('{}'); return; }
    try {
      if (!cache || Date.now() - cache.at > 10 * 60000) {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('Forecast unavailable');
        const data = await response.json();
        if (!valid(data)) throw new Error('Invalid forecast');
        cache = { data, at: Date.now() };
      }
      res.end(JSON.stringify(cache.data));
    } catch { res.statusCode = 502; res.end('{"error":"Forecast unavailable"}'); }
  };
}
