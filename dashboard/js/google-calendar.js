// Only normalized event data reaches the browser; OAuth credentials stay on the server.
(function () {
  const D = window.DATA, App = window.App;
  D.calendar = { live: false, label: 'Google · Connecting', state: 'loading' };
  let pending = false;
  function date(value, allDay) {
    // Google all-day ends are exclusive; parse date-only strings in local time.
    return new Date(allDay ? value + 'T00:00:00' : value);
  }
  async function sync() {
    if (pending) return;
    pending = true;
    try {
      const statusResponse = await fetch('/api/google-calendar/status', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000) });
      if (!statusResponse.ok) throw new Error('Calendar server unavailable');
      const status = await statusResponse.json();
      if (!status.selected) {
        D.events = [];
        D.calendar.live = false;
        D.calendar.syncedAt = null;
        D.calendar.state = status.connected ? 'not-selected' : 'not-connected';
        D.calendar.setupRequired = true;
        D.calendar.label = status.connected ? 'Google · Select calendar' : 'Google · Not connected';
        return;
      }
      // Clear any previous calendar data when beginning the first live sync.
      if (!D.calendar.live) D.events = [];
      D.calendar.live = true;
      const response = await fetch('/api/google-calendar/events', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(60000) });
      if (!response.ok) {
        let detail; try { detail = await response.json(); } catch {}
        throw Object.assign(new Error('Calendar sync failed'), { code: detail && detail.code });
      }
      const data = await response.json();
      D.events = data.events.map(event => ({ ...event, start: date(event.start, event.allDay), end: date(event.end, event.allDay) }));
      D.calendar.syncedAt = data.syncedAt;
      D.calendar.state = 'synced';
      D.calendar.setupRequired = false;
      D.calendar.label = 'Google · Synced ' + new Date(data.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      const reconnect = error.code === 'reauthorization-required' || error.code === 'google-oauth-failed';
      D.calendar.setupRequired = reconnect || error.code === 'calendar-access-denied';
      D.calendar.state = reconnect ? 'reconnect' : D.calendar.syncedAt ? 'stale' : 'unavailable';
      D.calendar.label = reconnect ? 'Google · Reconnect required' : error.code === 'calendar-access-denied' ? 'Google · Calendar access denied' : D.calendar.syncedAt ? 'Google · Stale — retrying' : 'Google · Unavailable';
    } finally {
      pending = false;
      App.emit('data');
      App.rerender();
    }
  }
  App.syncCalendar = sync;
  // Allow the shell and views to finish registering before the first refresh.
  setTimeout(sync, 0);
  setInterval(sync, 5 * 60000);
  window.addEventListener('focus', sync);
})();
