// Original shopping controls backed by Todoist; no local-only edits.
(function () {
  'use strict';
  var el, draft = '', store = 'all', drawer = false, pending = {};
  function category(t) {
    var name = t.name.toLowerCase();
    var hit = DATA.catalog.find(function (c) { return c[0].toLowerCase() === name; }) ||
      DATA.catalog.find(function (c) { var n = c[0].toLowerCase(); return n.indexOf(name) !== -1 || name.indexOf(n) !== -1; });
    return hit ? hit[1] : /\bbars\b/.test(name) ? 'Snacks' : 'Other';
  }
  function visible(t) { return store === 'all' || t.store === store; }
  function onList(t) {
    return DATA.groceries.find(function (g) { return g.name.toLowerCase() === t.name.toLowerCase() && g.store === (store === 'all' ? t.store : store); });
  }
  function blocked() { return Shopping.state.busy || !Shopping.state.connected; }
  function disabled(extra) { return blocked() || extra ? ' disabled' : ''; }
  function suggestions() {
    var s = Shopping.state, q = draft.trim().toLowerCase();
    var staples = s.usuals.filter(function (t) { return !q || t.name.toLowerCase().indexOf(q) !== -1; });
    return '<div class="label">' + (q ? 'Suggestions' : 'Usuals · tap to add') + '</div><div class="s-usuals">' + staples.map(function (t) {
      var on = onList(t);
      return '<button class="s-tile' + (on ? ' is-on' : '') + '" data-staple="' + App.esc(t.id) + '"' + disabled(!!on) + '><b>' + App.esc(t.name) + '</b><span>' + (on ? 'On list · ×' + on.qty : category(t)) + '</span></button>';
    }).join('') + '</div>' + (!staples.length && !q ? '<p>' + (s.usualsConfigured ? 'Add reusable items to Shopping usuals in Todoist.' : 'The usuals project is not connected.') + '</p>' : '') +
      (q ? '<button class="s-ac-row s-ac-row--new" data-add' + disabled() + '><b>Add “' + App.esc(draft.trim()) + '”</b>' + App.icon('plus', 26) + '</button>' : '');
  }
  function row(t) {
    return '<div class="s-row' + (pending[t.id] ? ' is-checking' : '') + '"><button class="s-hit" data-check="' + App.esc(t.id) + '"' + disabled(t.uncompletable) + ' aria-label="Check off ' + App.esc(t.name) + '"><span class="s-box">' + App.icon('check', 22) + '</span><span class="s-name"><b>' + App.esc(t.name) + '</b>' + (t.note ? '<small>' + App.esc(t.note) + '</small>' : '') + '</span>' + (store === 'all' && t.store === 'amazon' ? '<span class="s-store">Amazon</span>' : '') + '</button>' +
      '<div class="s-qty"><button data-qty="-1" data-id="' + App.esc(t.id) + '" aria-label="Less ' + App.esc(t.name) + '"' + disabled(t.uncompletable || pending[t.id] || t.qty <= 1) + '>' + App.icon('minus', 22) + '</button><span class="num">' + t.qty + '</span><button data-qty="1" data-id="' + App.esc(t.id) + '" aria-label="More ' + App.esc(t.name) + '"' + disabled(t.uncompletable || pending[t.id] || t.qty >= 999) + '>' + App.icon('plus', 22) + '</button></div></div>';
  }
  function render() {
    if (!el) return;
    var focused = el.contains(document.activeElement) && document.activeElement.matches('.s-input');
    var caret = focused ? document.activeElement.selectionStart : null;
    var oldList = el.querySelector('.s-list'), scroll = oldList ? oldList.scrollTop : 0;
    var s = Shopping.state, tasks = DATA.groceries.filter(visible), recent = s.recent.filter(visible);
    var groups = DATA.catOrder[store].concat(['Other']).map(function (cat) {
      var items = tasks.filter(function (t) { return category(t) === cat; });
      return items.length ? '<div class="s-cat"><div class="s-cat-h"><span class="label">' + App.esc(cat) + '</span><span class="label">' + items.length + '</span></div>' + items.map(row).join('') + '</div>' : '';
    }).join('');
    el.innerHTML = '<div class="shop"><header class="s-head"><div><h1 class="serif">Groceries</h1></div><div class="s-count"><span class="num">' + tasks.length + '</span> to get</div><div class="seg s-stores">' + [['all', 'All']].concat(DATA.stores.map(function (t) { return [t.id, t.name]; })).map(function (t) {
      return '<button data-store="' + t[0] + '" class="' + (store === t[0] ? 'is-on' : '') + '">' + t[1] + ' <span class="num">' + DATA.groceries.filter(function (g) { return t[0] === 'all' || g.store === t[0]; }).length + '</span></button>';
    }).join('') + '</div></header><div class="s-list"><div class="s-sync"><span role="status">' + App.esc(s.message) + '</span><button class="btn btn--ghost" data-refresh' + (s.busy ? ' disabled' : '') + '>Refresh</button></div>' + groups + (!tasks.length && s.connected ? '<div class="s-empty serif">All stocked up.<br><i>Nothing left to buy.</i></div>' : '') +
      (recent.length ? '<div class="s-drawer' + (drawer ? ' is-open' : '') + '"><button class="s-drawer-h" data-drawer><span>' + App.icon('check', 22) + ' Got it (' + recent.length + ')</span><span class="label">' + (drawer ? 'Hide' : 'Show') + '</span></button>' + (drawer ? '<div class="s-drawer-list"><p>Checked here during this session</p>' + recent.map(function (t) { return '<button class="s-got" data-revive="' + App.esc(t.id) + '"' + disabled() + '>' + App.esc(t.name) + '<span class="label">Add back</span></button>'; }).join('') + '<button class="btn btn--ghost" data-clear>Clear checked history</button></div>' : '') + '</div>' : '') +
      '</div><aside class="s-side"><form class="s-add"><label class="s-input-wrap">' + App.icon('plus', 30) + '<input class="s-input" aria-label="New shopping item" placeholder="Add an item…" maxlength="500" autocomplete="off" enterkeyhint="done"' + disabled() + '></label></form><div class="s-suggest">' + suggestions() + '</div></aside></div>';
    el.querySelector('.s-list').scrollTop = scroll;
    var input = el.querySelector('input'); input.value = draft;
    if (focused && !input.disabled) { input.focus(); input.setSelectionRange(caret, caret); }
    input.addEventListener('input', function () { draft = input.value; el.querySelector('.s-suggest').innerHTML = suggestions(); });
    el.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); add(); });
  }
  async function add(stapleId) {
    if (blocked() || (!stapleId && !draft.trim())) return;
    var body = { action: 'add' };
    if (store !== 'all') body.store = store;
    if (stapleId) body.stapleId = stapleId; else body.name = draft.trim();
    if (await Shopping.change(body)) { draft = ''; render(); App.toast('Shopping list updated', { icon: 'cart', ms: 2500 }); }
  }
  function check(task) {
    if (pending[task.id]) { clearTimeout(pending[task.id]); delete pending[task.id]; return render(); }
    pending[task.id] = setTimeout(async function () {
      // Another write may be in flight: wait rather than lose the check-off.
      while (Shopping.state.busy) await new Promise(function (resolve) { setTimeout(resolve, 100); });
      if (!pending[task.id]) return;
      delete pending[task.id];
      await Shopping.change({ action: 'complete', id: task.id }); render();
    }, 5000);
    render();
    App.toast('<b>' + App.esc(task.name) + '</b> checked off', { icon: 'check', ms: 5000, undo: function () { clearTimeout(pending[task.id]); delete pending[task.id]; render(); } });
  }
  App.on('shopping-updated', render);
  App.register('shopping', { show: function (target) {
    if (!el) {
      el = target;
      el.addEventListener('click', function (e) {
        var t;
        if ((t = e.target.closest('[data-store]'))) { store = t.dataset.store; return render(); }
        if ((t = e.target.closest('[data-check]'))) { var task = DATA.groceries.find(function (g) { return g.id === t.dataset.check; }); if (task && !blocked()) check(task); return; }
        if ((t = e.target.closest('[data-qty]'))) { var g = DATA.groceries.find(function (g) { return g.id === t.dataset.id; }); if (g) Shopping.change({ action: 'quantity', id: g.id, qty: g.qty + Number(t.dataset.qty) }); return; }
        if ((t = e.target.closest('[data-staple]'))) return add(t.dataset.staple);
        if (e.target.closest('[data-add]')) return add();
        if (e.target.closest('[data-refresh]') && !Shopping.state.busy) return Shopping.sync();
        if (e.target.closest('[data-drawer]')) { drawer = !drawer; return render(); }
        if ((t = e.target.closest('[data-revive]'))) return Shopping.change({ action: 'reopen', id: t.dataset.revive });
        if (e.target.closest('[data-clear]')) { Shopping.state.recent = []; render(); }
      });
    }
    render();
  } });
})();
