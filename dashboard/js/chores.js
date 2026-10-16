(function () {
  'use strict';
  var state = { connected: false, busy: false, message: 'Connecting to Todoist…', syncedAt: null, tasks: [] };
  var days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit', day: '2-digit' }).format(App.now()); }
  function weekday(date) { return days[(new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7]; }
  function forDate(date) {
    var rows = [];
    state.tasks.filter(function (c) { return c.days.includes(weekday(date)); }).forEach(function (c) {
      c.slots.forEach(function (slot) { c.people.forEach(function (person) {
        var done = ((c.completions[date] || {})[slot] || {})[person];
        rows.push(Object.assign({}, c, { taskId: c.id, id: c.id + '_' + person + '_' + slot, r: slot, who: person, done: !!done, doneBy: done && done.by }));
      }); });
    });
    return rows;
  }
  function emit() {
    window.DATA.chores = forDate(today());
    window.DATA.stars = { harvey: 0, frankie: 0 };
    state.tasks.forEach(function (c) { Object.keys(c.completions).forEach(function (d) {
      Object.values(c.completions[d]).forEach(function (slot) { Object.values(slot).forEach(function (hit) { if (window.DATA.stars[hit.by] != null && d <= today()) window.DATA.stars[hit.by] += hit.stars || 0; }); });
    }); });
    App.emit('data'); App.emit('chores-updated');
  }
  async function api(body) {
    var r = await fetch('/api/todoist/chores', { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('application/json')) throw Error(data.error || 'Sign in to connect Chores.');
    return data;
  }
  var syncing;
  function sync() {
    if (syncing) return syncing;
    syncing = (async function () {
      try { var data = await api(); state.tasks = data.chores; state.syncedAt = data.syncedAt; state.connected = true; state.message = 'Todoist · Synced ' + new Date(data.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + (data.unmapped ? ' · ' + data.unmapped + ' tasks need mapping in Todoist' : ''); }
      catch (e) { state.connected = false; state.message = (state.syncedAt ? 'Stale · last synced ' + new Date(state.syncedAt).toLocaleTimeString() + '. ' : '') + e.message; }
      emit();
    })().finally(function () { syncing = null; });
    return syncing;
  }
  window.Chores = { state: state, today: today, days: days, weekday: weekday, forDate: forDate, sync: sync,
    change: async function (body) {
      if (state.busy || !state.connected) return false;
      state.busy = true; emit();
      try { if (syncing) await syncing; await api(body); await sync(); return state.connected; }
      catch (e) { state.connected = false; state.message = e.message + ' Refresh before trying again.'; return false; }
      finally { state.busy = false; emit(); }
    }
  };
  App.on('ready', function () { sync(); setInterval(function () { if (!state.busy) sync(); }, 60000); });
  App.on('time', emit);
})();
