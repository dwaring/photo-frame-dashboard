// Only normalized event data reaches the browser; OAuth credentials stay on the server.
(function () {
  const D = window.DATA, App = window.App;
  D.calendar = { live: false, label: 'Google · Not connected' };
  let pending = false;
  function date(value, allDay) {
    // Google all-day ends are exclusive; parse date-only strings in local time.
    return new Date(allDay ? value + 'T00:00:00' : value);
  }
  async function sync() {
    if (pending) return;
    pending = true;
    try {
      const statusResponse = await fetch('/api/google-calendar/status', { signal: AbortSignal.timeout(20000) });
      if (!statusResponse.ok) throw new Error('Calendar server unavailable');
      const status = await statusResponse.json();
      if (!status.selected) {
        D.calendar.label = status.connected ? 'Google · Select calendar' : 'Google · Not connected';
        return;
      }
      // Clear any previous calendar data when beginning the first live sync.
      if (!D.calendar.live) D.events = [];
      D.calendar.live = true;
      const response = await fetch('/api/google-calendar/events', { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error('Calendar sync failed');
      const data = await response.json();
      D.events = data.events.map(event => ({ ...event, start: date(event.start, event.allDay), end: date(event.end, event.allDay) }));
      D.calendar.syncedAt = data.syncedAt;
      D.calendar.label = 'Google · Synced ' + new Date(data.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      D.calendar.label = D.calendar.live ? (D.calendar.syncedAt ? 'Google · Stale — retrying' : 'Google · Sync failed') : 'Google · Unavailable';
    } finally {
      pending = false;
      App.emit('data');
      App.rerender();
    }
  }
  // Allow the shell and views to finish registering before the first refresh.
  setTimeout(sync, 0);
  setInterval(sync, 5 * 60000);
  window.addEventListener('focus', sync);
})();
