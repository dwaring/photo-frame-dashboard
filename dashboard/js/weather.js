// Public weather endpoint: no API keys or service credentials are sent to the browser.
const App = window.App;
const ZONE = 'Australia/Adelaide';
const CACHE = 'adelaide-bom-weather-v2';
const INTERVAL = 10 * 60 * 1000;
export const weatherURL = '/api/weather/forecast';
function condition(code, day) {
  return code === 0 || code === 1 ? (day ? 'sun' : 'moon') : code === 2 ? 'partly' : code >= 51 && code <= 67 || code >= 80 && code <= 82 || code >= 95 ? 'rain' : 'cloud';
}
function finite(value) {
  if (!Number.isFinite(value)) throw new Error('Invalid weather data');
  return value;
}
export function normalizeWeather(data, fetchedAt = Date.now()) {
  const h = data.hourly;
  if (!h?.time?.length || h.time.length < 30) throw new Error('Missing forecast');
  const hourly = h.time.map((time, i) => ({
    time: finite(time) * 1000, t: Math.round(finite(h.temperature_2m[i])),
    p: finite(h.precipitation_probability[i]), c: condition(finite(h.weather_code[i]), finite(h.is_day[i]))
  }));
  return {
    location: 'Adelaide, AU', forecastAt: fetchedAt,
    hi: Math.round(finite(data.daily.temperature_2m_max[0])), lo: Math.round(finite(data.daily.temperature_2m_min[0])),
    hourly
  };
}
export function normalizeObservation(data) {
  const rows = data.observations?.data;
  const row = rows?.filter(r => r.wmo === 94648 && Number.isFinite(r.air_temp))
    .sort((a, b) => String(b.aifstime_utc).localeCompare(String(a.aifstime_utc)))[0];
  if (!row || !/^\d{14}$/.test(row.aifstime_utc)) throw new Error('Invalid station observation');
  const t = row.aifstime_utc;
  const observedAt = Date.parse(`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}T${t.slice(8,10)}:${t.slice(10,12)}:${t.slice(12,14)}Z`);
  if (!Number.isFinite(observedAt) || observedAt > Date.now() + 5 * 60000) throw new Error('Invalid observation time');
  const label = row.weather && row.weather !== '-' ? row.weather : row.cloud && row.cloud !== '-' ? row.cloud : 'Station observation';
  return { observedAt, station: 'BoM West Terrace / ngayirdapira',
    current: { temp: row.air_temp, label, cond: /rain|shower|storm/i.test(label) ? 'rain' : 'thermo' },
    feels: Number.isFinite(row.apparent_t) ? row.apparent_t : null,
    humidity: Number.isFinite(row.rel_hum) ? row.rel_hum : null,
    wind: Number.isFinite(row.wind_spd_kmh) ? row.wind_spd_kmh : null };
}
const clock = time => new Intl.DateTimeFormat('en-AU', { timeZone: ZONE, hour: 'numeric', minute: '2-digit' }).format(time);
const date = time => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(time);
function usable(w) {
  return w.current && Date.now() - w.observedAt < 2 * 60 * 60 * 1000 && date(w.observedAt) === date(Date.now());
}
App.weatherNow = function () {
  const w = window.DATA.weather;
  if (!w.current) return { temp: '—', cond: 'cloud', summary: w.status === 'loading' ? 'Loading Adelaide weather…' : 'Weather unavailable', status: w.status };
  const stale = w.status !== 'live' || !usable(w) || Date.now() - w.fetchedAt > 2 * INTERVAL;
  return { ...w.current, hi: w.forecastAt && date(w.forecastAt) === date(Date.now()) ? w.hi : '—', lo: w.forecastAt && date(w.forecastAt) === date(Date.now()) ? w.lo : '—',
    summary: w.current.label + (stale ? ' · Stale weather' : ''),
    advice: [w.feels !== null ? 'Feels like ' + w.feels + '°C' : '', w.wind !== null ? 'Wind ' + w.wind + ' km/h' : ''].filter(Boolean).join(' · '),
    status: (stale ? 'Stale · ' : '') + 'Observed ' + clock(w.observedAt) + ' Adelaide time'
  };
};
App.hourly = function (count) {
  const now = Date.now();
  const w = window.DATA.weather;
  const hours = w.forecastAt && Date.now() - w.forecastAt < 2 * 60 * 60000 ? w.hourly : [];
  return hours.filter((h, i) => h.time <= now ? hours[i + 1]?.time > now : true).slice(0, count)
    .map(h => ({ ...h, label: new Intl.DateTimeFormat('en-AU', { timeZone: ZONE, hour: 'numeric', hour12: true }).format(h.time).replace(/\s/g, '') }));
};
let pending = false;
async function refresh() {
  if (pending) return;
  pending = true;
  try {
    const [observation, forecast] = await Promise.allSettled([
      fetch('/api/weather/observations', { signal: AbortSignal.timeout(20000) }).then(r => { if (!r.ok) throw new Error('BoM unavailable'); return r.json(); }),
      fetch(weatherURL, { signal: AbortSignal.timeout(15000) }).then(r => { if (!r.ok) throw new Error('Forecast unavailable'); return r.json(); })
    ]);
    const w = window.DATA.weather;
    if (forecast.status === 'fulfilled') {
      try { Object.assign(w, normalizeWeather(forecast.value));
        localStorage.setItem(CACHE + '-forecast', JSON.stringify({ raw: forecast.value, fetchedAt: w.forecastAt }));
      } catch { /* Retain the last valid forecast on transient failures. */ }
    }
    if (observation.status !== 'fulfilled') throw new Error('BoM unavailable');
    Object.assign(w, normalizeObservation(observation.value), { fetchedAt: Date.now(), status: 'live' });
    if (!usable(w)) w.status = 'stale';
    try { localStorage.setItem(CACHE, JSON.stringify({ raw: observation.value, fetchedAt: w.fetchedAt })); } catch {}

  } catch {
    window.DATA.weather.status = window.DATA.weather.current ? 'stale' : 'unavailable';
  } finally {
    pending = false;
    App.emit('data');
    App.emit('weather');
  }
}
App.on('ready', () => {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE));
    const w = { ...normalizeObservation(cached.raw), fetchedAt: cached.fetchedAt, location: 'Adelaide, AU', hourly: [] };
    if (usable(w)) { w.status = 'stale'; window.DATA.weather = w; }
  } catch {}
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE + '-forecast'));
    if (Date.now() - cached.fetchedAt < 2 * 60 * 60000) Object.assign(window.DATA.weather, normalizeWeather(cached.raw, cached.fetchedAt));
  } catch {}
  refresh();
  setInterval(refresh, INTERVAL);
  window.addEventListener('online', refresh);
});
