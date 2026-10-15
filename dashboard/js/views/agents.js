// Personal account stats supplied by the server; no credentials in the browser.
(function () {
  'use strict';
  var V = { el: null, data: null, busy: false, error: '', checked: 0 };
  var esc = function (value) { return App.esc(String(value)); };
  var fmt = function (value) { return typeof value === 'number' ? value.toLocaleString() : 'Unavailable'; };
  function metric(label, value) {
    return '<div class="ag-metric"><span class="num">' + esc(fmt(value)) + '</span><span class="label">' + label + '</span></div>';
  }
  function meter(w, label) {
    if (!w || typeof w.usedPercent !== 'number') return '';
    var minutes = w.windowDurationMins;
    if (minutes === 10080) label = 'Weekly usage';
    else if (minutes === 1440) label = 'Daily usage';
    else if (minutes > 0 && minutes % 60 === 0) label = (minutes / 60) + '-hour usage';
    else if (minutes > 0) label = minutes + '-minute usage';
    var pct = Math.max(0, Math.min(100, w.usedPercent));
    var reset = w.resetsAt ? new Date(w.resetsAt * 1000) : null;
    return '<div class="ag-meter"><div class="ag-meter-top"><b>' + esc(label) + '</b><span>' + Math.round(pct) + '% used</span></div>' +
      '<div class="ag-bar" role="meter" aria-label="' + esc(label) + ' usage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>' +
      '<p class="ag-caption">' + (reset ? (reset.getTime() <= Date.now() ? 'Reset time passed · awaiting updated usage' : 'Resets ' + esc(reset.toLocaleString())) : 'Reset time unavailable') + '</p></div>';
  }
  function render() {
    if (!V.el) return;
    var d = V.data;
    var stale = d && (V.error || Date.now() - Date.parse(d.syncedAt) > 5 * 60000);
    var plan = d ? (d.plan === 'unknown' ? 'Plan unavailable' : d.plan.charAt(0).toUpperCase() + d.plan.slice(1)) : 'Plus · configured';
    var status = V.busy ? 'Checking usage…' : stale ? 'Stale · sync failed or overdue' : d ? 'Connected' : 'Not connected';
    var body = '';
    if (d) {
      body = '<div class="ag-quotas">' + d.quotas.map(function (q) {
        return '<section><h3>' + esc(q.id === 'codex' ? 'Codex allowance' : q.id) + '</h3>' + meter(q.primary, 'Primary window') + meter(q.secondary, 'Secondary window') + '</section>';
      }).join('') + '</div>';
      if (!d.quotas.length) body += '<p>No quota windows returned for this account.</p>';
      body += '<div class="ag-metrics">' + metric('Lifetime tokens', d.summary.lifetimeTokens) + metric('Peak daily tokens', d.summary.peakDailyTokens) + metric('Current streak · days', d.summary.currentStreakDays) + '</div>';
      if (d.daily.length) body += '<details class="ag-daily"><summary>Daily token activity</summary><div>' + d.daily.map(function (day) {
        return '<p><span>' + esc(day.date) + '</span><b class="num">' + esc(fmt(day.tokens)) + '</b></p>';
      }).join('') + '</div></details>';
      body += '<p class="ag-caption">Account activity reported by Codex services. Coverage of all ChatGPT conversations is not verified.</p>';
    } else {
      body = '<div class="ag-empty"><div class="label">Live usage</div><h3 class="serif">' + (V.busy ? 'Connecting…' : 'Usage unavailable') + '</h3>' +
        '<p>' + esc(V.error || 'The hosted usage service needs a ChatGPT account connection.') + '</p></div>';
    }
    V.el.innerHTML = '<div class="agents"><header class="ag-top"><div><div class="label">Your AI subscription</div><h1 class="serif">Agents</h1></div>' +
      '<button class="ag-refresh" data-refresh' + (V.busy ? ' disabled' : '') + '>Refresh usage</button></header>' +
      '<section class="ag-card" aria-labelledby="ag-chatgpt"><header class="ag-head"><div class="ag-id"><i class="ag-swatch" aria-hidden="true"></i><h2 id="ag-chatgpt">ChatGPT</h2><span class="ag-plan">' + esc(plan) + '</span></div>' +
      '<span class="ag-status" role="status">' + status + '</span></header>' +
      (d && V.error ? '<p class="ag-caption">' + esc(V.error) + '</p>' : '') + body +
      '<footer class="ag-foot"><span>' + (d ? 'Last synced ' + esc(new Date(d.syncedAt).toLocaleString()) : 'No usage data synced') + '</span>' +
      '<a href="https://chatgpt.com/settings/usage" target="_blank" rel="noopener noreferrer">Open ChatGPT usage ↗</a></footer></section></div>';
  }
  async function refresh() {
    if (V.busy) return;
    V.busy = true; render();
    try {
      var response = await fetch('/api/chatgpt/usage', { cache: 'no-store', signal: AbortSignal.timeout(55000) });
      var data = await response.json();
      if (data.reason === 'local-unavailable') throw new Error('Local usage sync failed. Check that Codex is installed and signed in on this Mac, then retry.');
      if (!response.ok) throw new Error('Usage sync failed. Retry shortly.');
      if (!data.connected) throw new Error(data.reason === 'not-configured' ? 'The hosted usage service has not been signed in yet.' : 'Usage is unavailable. Check the service connection.');
      if (data.source !== 'codex-account' || !Number.isFinite(Date.parse(data.syncedAt)) || !Array.isArray(data.quotas) || !data.summary || !Array.isArray(data.daily)) throw new Error('Invalid usage response.');
      V.data = data; V.error = '';
    } catch (error) {
      V.error = error.message || 'Usage sync failed.';
    } finally {
      V.busy = false; V.checked = Date.now(); render();
    }
  }
  App.register('agents', {
    show: function (el) {
      if (!V.el) { V.el = el; el.addEventListener('click', function (e) { if (e.target.closest('[data-refresh]')) refresh(); }); }
      render();
      if (!V.checked || Date.now() - V.checked >= 120000) refresh();
    }
  });
  App.on('minute', function () {
    if (!V.el) return;
    render();
    if (location.hash === '#agents' && Date.now() - V.checked >= 120000) refresh();
  });
})();
