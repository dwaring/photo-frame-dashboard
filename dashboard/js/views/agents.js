// ChatGPT subscription overview. No personal usage API is connected.
(function () {
  'use strict';

  App.register('agents', {
    show: function (el) {
      el.innerHTML = '<div class="agents">' +
        '<header class="ag-top"><div><div class="label">Your AI subscription</div><h1 class="serif">Agents</h1></div></header>' +
        '<section class="ag-card" aria-labelledby="ag-chatgpt">' +
          '<header class="ag-head"><div class="ag-id"><i class="ag-swatch" aria-hidden="true"></i><h2 id="ag-chatgpt">ChatGPT</h2><span class="ag-plan">Pro</span></div>' +
          '<span class="ag-status">Not connected</span></header>' +
          '<p class="ag-caption">Plan set from your preference · account not verified</p>' +
          '<div class="ag-empty"><div class="label">Live usage</div><h3 class="serif">Stats unavailable</h3>' +
            '<p>No supported personal ChatGPT usage API has been identified for this dashboard. Usage totals, remaining allowances and reset times are unavailable here.</p>' +
            '<a class="ag-link" href="https://chatgpt.com/settings/usage" target="_blank" rel="noopener noreferrer">Open ChatGPT usage ↗</a>' +
            '<p class="ag-caption">Sign in to ChatGPT to view the usage information available for your account.</p></div>' +
          '<footer class="ag-foot">No usage data synced</footer>' +
        '</section></div>';
    }
  });
})();
