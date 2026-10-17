// Tasks / chores: one lane per person + "Anyone", scoped to the current time-of-day routine.
(function () {
  'use strict';
  var D = window.DATA;
  var V = { el: null, routine: null, date: null, editing: false, pending: {} };
  var LANES = ['darren', 'nadine', 'harvey', 'frankie', 'any'];

  function date() { return V.date || Chores.today(); }
  function chores() { return Chores.forDate(date()); }
  function routine() {
    var r = V.routine ? D.routines.filter(function (r) { return r.id === V.routine; })[0] : App.currentRoutine();
    return Object.assign({}, r, { name: App.routineName(D.routines.find(function (x) { return x.id === r.id; }), date()) });
  }
  function listFor(who, r) {
    return chores().filter(function (c) { return c.r === r.id && c.who === who; })
      .sort(function (a, b) { return (a.done - b.done) || ((b.overdue ? 1 : 0) - (a.overdue ? 1 : 0)); });
  }

  function row(c, p) {
    var pend = V.pending[c.id];
    return '<button ' + ((!Chores.state.connected || Chores.state.busy || date() > Chores.today()) && !V.editing ? 'disabled ' : '') + 'class="ch' + (c.done ? ' is-done' : '') + (pend ? ' is-checking' : '') + (c.overdue && !c.done ? ' is-overdue' : '') + '" data-ch="' + App.esc(c.id) + '">' +
      '<span class="ch-emoji"><span class="ch-check"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span></span>' +
      '<span class="ch-text"><b>' + App.esc(c.title) + '</b>' +
      (c.overdue && !c.done ? '<small class="ch-late">Overdue</small>' : (c.doneBy ? '<small>by ' + App.esc(App.person(c.doneBy).name) + '</small>' : '')) +
      '</span>' +
      '</button>';
  }

  function weekGrid(id) {
    var base = new Date(Chores.today() + 'T12:00:00Z');
    base.setUTCDate(base.getUTCDate() - (base.getUTCDay() + 6) % 7);
    var w = Array.from({ length: 7 }, function (_, i) {
      var d = new Date(base); d.setUTCDate(d.getUTCDate() + i); var key = d.toISOString().slice(0, 10);
      var scheduled = Chores.forDate(key).filter(function (c) { return c.who === id && key >= c.trackingSince; });
      return key > Chores.today() || !scheduled.length ? null : scheduled.every(function (c) { return c.done; }) ? 1 : 0;
    });
    var today = (new Date(Chores.today() + 'T12:00:00Z').getUTCDay() + 6) % 7;
    return '<div class="ch-week"><div class="label">This week</div><div class="ch-week-row">' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (d, i) {
      var cls = w[i] === null ? 'is-future' : i === today ? 'is-today' : (w[i] ? 'is-hit' : 'is-miss');
      return '<span class="' + cls + '"><i></i>' + d + '</span>';
    }).join('') + '</div></div>';
  }

  function lane(who, r) {
    var p = App.person(who), list = listFor(who, r);
    var done = list.filter(function (c) { return c.done; }).length;
    var all = list.length && done === list.length;
    return '<section class="ch-lane' + (all ? ' is-complete' : '') + '" data-lane="' + who + '" style="' + App.pstyle(p) + '">' +
      '<header class="ch-head">' + App.avatar(p, 42) +
      '<div><b>' + (who === 'any' ? 'Anyone' : p.name) + '</b>' +
      '<span class="ch-sub">' + (who === 'any' ? 'Up for grabs' : (list.length ? done + ' of ' + list.length : 'Nothing')) + '</span></div>' +
      '<div class="ch-ring">' + App.ring(done, list.length || 1, 46) + '<span class="num">' + (all ? '✓' : list.length ? done + '/' + list.length : '–') + '</span></div>' +
      '</header>' +
      '<div class="ch-list">' + (list.length ? list.map(function (c) { return row(c, p); }).join('') : '<div class="ch-none serif"><i>Nothing this ' + (r.id === 'evening' ? 'evening' : r.id === 'morning' ? 'morning' : 'afternoon') + '</i></div>') +
      (all ? '<div class="ch-alldone serif">All done<i>!</i></div>' : '') + '</div>' +
      weekGrid(who) +
      '</section>';
  }

  function render() {
    var r = routine(), auto = App.currentRoutine();
    var inR = chores().filter(function (c) { return c.r === r.id; });
    var done = inR.filter(function (c) { return c.done; }).length;
    V.el.innerHTML = '<div class="tasks">' +
      '<header class="t-head">' +
      '<div class="t-title"><div class="label">' + (r.id === auto.id ? 'Right now · ' : '') + r.range + '</div><h1 class="serif">' + r.name + '</h1></div>' +
      '<div class="seg">' + D.routines.map(function (x) { return '<button class="' + (x.id === r.id ? 'is-on' : '') + '" data-r="' + x.id + '">' + App.routineName(x, date()) + '</button>'; }).join('') + '</div>' +
      '<div class="t-progress"><span class="num">' + done + '<small>/' + inR.length + '</small></span><div class="t-bar"><i style="width:' + (inR.length ? done / inR.length * 100 : 0) + '%"></i></div><span class="label">done</span></div>' +
      '</header>' +
      '<div class="ch-controls"><input aria-label="Chore date" type="date" data-date value="' + date() + '"><span role="status">' + App.esc(Chores.state.message) + (V.editing ? ' · Tap a chore to edit' : '') + '</span><button data-refresh>Refresh</button><button data-edit>' + (V.editing ? 'Finish editing' : 'Edit chores') + '</button><button data-add>Add chore</button></div>' +
      '<div class="ch-lanes">' + LANES.map(function (w) { return lane(w, r); }).join('') + '</div>' +
      '</div>';
  }

  async function complete(c, btn, by) {
    if (V.pending[c.id]) return;
    V.pending[c.id] = true;
    var ok = await Chores.change({ action: c.done ? 'reopen' : 'complete', id: c.taskId, person: c.who, r: c.r, date: date(), by: by || c.doneBy || c.who });
    delete V.pending[c.id];
    render();
    if (ok) App.toast(App.esc(c.title) + (c.done ? ' reopened' : ' done'), { icon: 'check' });
  }

  function editor(c) {
    c = c || { title: '', people: ['any'], slots: [routine().id], days: Chores.days.slice() };
    App.sheet('<form class="sheet-pad chore-form"><h2 class="serif sheet-h">' + (c.id ? 'Edit chore' : 'Add chore') + '</h2>' +
      '<label>Chore<input name="title" required maxlength="500" value="' + App.esc(c.title) + '"></label>' +
      '<fieldset><legend>Family members · select everyone this chore applies to</legend>' + LANES.map(function (id) { return '<label><input type="checkbox" name="people" value="' + id + '"' + (c.people.includes(id) ? ' checked' : '') + '>' + (id === 'any' ? 'Anyone (one person does it)' : App.esc(App.person(id).name)) + '</label>'; }).join('') + '</fieldset>' +
      '<fieldset><legend>Timeslots</legend>' + D.routines.map(function (r) { return '<label><input type="checkbox" name="slots" value="' + r.id + '"' + (c.slots.includes(r.id) ? ' checked' : '') + '>' + App.routineName(r, date()) + '</label>'; }).join('') + '</fieldset>' +
      '<fieldset><legend>Days</legend>' + Chores.days.map(function (d) { return '<label><input type="checkbox" name="days" value="' + d + '"' + (c.days.includes(d) ? ' checked' : '') + '>' + d + '</label>'; }).join('') + '</fieldset>' +
      '<p role="status"></p><button type="submit">Save to Todoist</button></form>', {
      onMount: function (s, close) { s.querySelector('form').addEventListener('submit', async function (e) {
        e.preventDefault(); var f = new FormData(e.target); var button = e.target.querySelector('[type="submit"]'); button.disabled = true;
        var ok = await Chores.change({ action: 'save', id: c.taskId || c.id, title: f.get('title'), people: f.getAll('people'), slots: f.getAll('slots'), days: f.getAll('days') });
        if (ok) close(); else { button.disabled = false; e.target.querySelector('[role="status"]').textContent = Chores.state.message; }
      }); }
    });
  }

  // "Anyone" chores record who completed the shared occurrence.
  function whoDidIt(c, btn) {
    App.sheet('<div class="sheet-pad"><div class="label">' + App.esc(c.title) + '</div><h2 class="serif sheet-h">Who did it?</h2>' +
      '<div class="add-who add-who--big">' + D.people.map(function (p) {
        return '<button class="who-btn" data-by="' + p.id + '" style="' + App.pstyle(p) + '">' + App.avatar(p, 88) + '<span>' + p.name + '</span></button>';
      }).join('') + '</div></div>', {
      onMount: function (s, close) {
        s.addEventListener('click', function (e) {
          var b = e.target.closest('[data-by]');
          if (!b) return;
          close();
          var fresh = V.el.querySelector('[data-ch="' + c.id + '"]');
          complete(c, fresh || btn, b.dataset.by);
        });
      }
    });
  }

  function onClick(e) {
    var t;
    if (e.target.closest('[data-refresh]')) { Chores.sync(); return; }
    if (e.target.closest('[data-edit]')) { V.editing = !V.editing; return render(); }
    if (e.target.closest('[data-add]')) { if (Chores.state.connected && !Chores.state.busy) editor(); return; }
    if ((t = e.target.closest('[data-r]'))) { V.routine = t.dataset.r === App.currentRoutine().id ? null : t.dataset.r; return render(); }
    if ((t = e.target.closest('[data-ch]'))) {
      var c = chores().filter(function (x) { return x.id === t.dataset.ch; })[0];
      if (!c || V.pending[c.id]) return;
      if (V.editing) { if (Chores.state.connected && !Chores.state.busy) editor(c); return; }
      if (!Chores.state.connected || Chores.state.busy || date() > Chores.today()) return;
      if (c.done) return complete(c, t);
      if (c.who === 'any') return whoDidIt(c, t);
      complete(c, t);
    }
  }

  App.register('tasks', {
    show: function (el) {
      if (!V.el) { V.el = el; el.addEventListener('click', onClick); el.addEventListener('change', function (e) { if (e.target.matches('[data-date]')) { V.date = /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) ? e.target.value : null; render(); } }); }
      render();
    }
  });
  App.on('chores-updated', function () { if (V.el) render(); });
  App.on('time', function () { V.routine = null; if (V.el) render(); });
})();
