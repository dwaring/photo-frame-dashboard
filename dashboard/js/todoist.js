(function () {
  'use strict';
  var state = { connected: false, busy: false, syncedAt: null, usuals: [], usualsConfigured: false, recent: [], message: 'Connecting to Todoist…' };
  async function api(body) {
    var r = await fetch('/api/todoist/tasks', { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('application/json')) {
      var error = await r.json().catch(function () { return {}; });
      throw Error(error.error || 'Sign in to the hosted dashboard to connect Todoist.');
    }
    return r.json();
  }
  function emit() { App.emit('data'); App.emit('shopping-updated'); }
  var syncing;
  function sync() {
    if (syncing) return syncing;
    syncing = read().finally(function () { syncing = null; });
    return syncing;
  }
  async function read() {
    try {
      var data = await api();
      window.DATA.groceries = data.tasks;
      state.usuals = data.staples || []; state.usualsConfigured = data.staplesConfigured;
      window.DATA.usuals = state.usuals.map(function (t) { return t.name; });
      state.recent = state.recent.filter(function (t) { return !data.tasks.some(function (a) { return a.id === t.id; }); });
      state.connected = true; state.syncedAt = data.syncedAt;
      state.message = 'Synced ' + new Date(data.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      state.connected = false;
      state.message = (state.syncedAt ? 'Stale · last synced ' + new Date(state.syncedAt).toLocaleTimeString() + '. ' : '') + e.message;
    }
    emit();
  }
  window.Shopping = {
    state: state,
    sync: sync,
    change: async function (body) {
      if (state.busy || !state.connected) return false;
      state.busy = true; emit();
      var ok = false;
      try {
        if (syncing) await syncing;
        var task = window.DATA.groceries.find(function (t) { return t.id === body.id; });
        await api(body);
        if (body.action === 'complete' && task && !task.recurring) state.recent.unshift(task);
        await sync(); ok = true;
      }
      catch (e) { state.connected = false; state.message = e.message + ' Refresh before trying again.'; }
      finally { state.busy = false; emit(); }
      return ok;
    }
  };
  App.on('ready', function () { sync(); setInterval(function () { if (!state.busy) sync(); }, 60000); });
})();
