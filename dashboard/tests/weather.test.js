import { test } from 'node:test';
import assert from 'node:assert/strict';
const handlers = {};
globalThis.window = { App: { on(name, fn) { handlers[name] = fn; } }, DATA: {} };
const { normalizeWeather, normalizeObservation } = await import('../js/weather.js');
function fixture() {
  const time = Math.floor(Date.now() / 3600000) * 3600;
  return {
    current: { time, temperature_2m: 19.2, apparent_temperature: 18, relative_humidity_2m: 60, wind_speed_10m: 15, weather_code: 95, is_day: 1 },
    hourly: { time: Array.from({ length: 48 }, (_, i) => time + i * 3600), temperature_2m: Array(48).fill(20), precipitation_probability: Array(48).fill(30), weather_code: Array(48).fill(0), is_day: Array(48).fill(0) },
    daily: { temperature_2m_max: [24], temperature_2m_min: [10] }
  };
}
test('uses current conditions separately from hourly forecast and preserves future dates', () => {
  const w = normalizeWeather(fixture());
  assert.equal(w.hourly[0].c, 'moon');
  assert.equal(w.hourly[24].time - w.hourly[0].time, 86400000);
  Object.assign(w, normalizeObservation({ observations: { data: [{ wmo: 94648, air_temp: 19.1, aifstime_utc: new Date().toISOString().replace(/[-:T]/g, '').slice(0,14), apparent_t: null, wind_spd_kmh: 7, cloud: 'Clear' }] } }), { forecastAt: Date.now() });
  assert.equal(w.current.temp, 19.1);
  assert.equal(w.feels, null);
  window.DATA.weather = w;
  assert.equal(window.App.hourly(7).length, 7);
  w.status = 'stale';
  assert.match(window.App.weatherNow().summary, /Stale/);
});
test('rejects incomplete or null weather values', () => {
  const raw = fixture();
  raw.hourly.temperature_2m[2] = null;
  assert.throws(() => normalizeWeather(raw));
  assert.throws(() => normalizeWeather({}));
});
test('shows unavailable state without fabricated temperature', () => {
  window.DATA.weather = { status: 'unavailable' };
  assert.equal(window.App.weatherNow().temp, '—');
  assert.equal(window.App.weatherNow().summary, 'Weather unavailable');
});

test('rejects missing station temperature and wrong station', () => {
  assert.throws(() => normalizeObservation({ observations: { data: [{ wmo: 94648, air_temp: null }] } }));
  assert.throws(() => normalizeObservation({ observations: { data: [{ wmo: 1, air_temp: 20 }] } }));
});

test('forecast refresh preserves station failure status and supplies max/min and icons', () => {
  const w = { status: 'stale', current: { temp: 19.1 } };
  Object.assign(w, normalizeWeather(fixture()));
  assert.equal(w.status, 'stale');
  assert.equal(w.current.temp, 19.1);
  window.DATA.weather = w;
  const shown = window.App.weatherNow();
  assert.equal(shown.hi, 24);
  assert.equal(shown.lo, 10);
  assert.ok(window.App.hourly(7).every(h => h.c === 'moon'));
});
