import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
test('client maps dates, persists completion before showing success, and retains stale data', async () => {
  const handlers = {}, events = [];
  let fail = false;
  const task = { id: 'a', title: 'Read', days: ['fri'], people: ['any'], slots: ['after'], emoji: '📖', completions: {} };
  const context = { window: { DATA: {} }, Intl, Date, AbortSignal, setInterval() {}, App: { now: () => new Date('2026-10-16T03:00:00Z'), on: (e, f) => handlers[e] = f, emit: e => events.push(e) }, fetch: async (url, options) => {
    if (fail) throw Error('Offline');
    if (options.method === 'POST') { const b = JSON.parse(options.body); task.completions[b.date] = { after: { any: { by: b.by } } }; return Response.json({ ok: true }); }
    return Response.json({ chores: [structuredClone(task)], syncedAt: '2026-10-16T03:00:00Z', unmapped: 0 });
  } };
  vm.runInNewContext(await readFile(new URL('./chores.js', import.meta.url), 'utf8'), context);
  const c = context.window.Chores;
  await c.sync(); assert.equal(c.today(), '2026-10-16'); assert.equal(c.forDate('2026-10-17').length, 0); assert.equal(context.window.DATA.chores[0].done, false);
  assert.equal(await c.change({ action: 'complete', id: 'a', date: '2026-10-16', by: 'harvey' }), true);
  assert.equal(context.window.DATA.chores[0].doneBy, 'harvey');
  await c.sync();
  fail = true; await c.sync(); assert.equal(c.state.connected, false); assert.match(c.state.message, /Stale/); assert.equal(context.window.DATA.chores[0].done, true);
  assert.equal(await c.change({ action: 'complete' }), false); assert.ok(events.includes('chores-updated'));
});
test('chores view scopes lanes by timeslot and date, and exposes mapping editor', async () => {
  const views = {}, listeners = {}, day = '2026-10-16'; let form;
  const tasks = [
    { id: 'morning1', title: 'Morning bed', who: 'harvey', people: ['harvey'], slots: ['morning'], r: 'morning', days: ['fri'], emoji: '🛏️', done: false },
    { id: 'after1', title: 'Read after school', who: 'frankie', people: ['frankie'], slots: ['after'], r: 'after', days: ['fri'], emoji: '📖', done: false }
  ];
  const routines = [{ id: 'morning', name: 'Morning', range: '6–11' }, { id: 'after', name: 'After school', range: '11–17' }, { id: 'evening', name: 'Evening', range: '17–24' }];
  const app = { register: (id, v) => views[id] = v, on() {}, currentRoutine: () => routines[0], routineName: (r, date) => r.id === 'after' && ['2026-10-17', '2026-10-18'].includes(date) ? 'Afternoon' : r.name, esc: s => String(s).replaceAll('"', '&quot;'), person: id => ({ id, name: id }), pstyle: () => '', avatar: () => '', ring: () => '', icon: () => '', sheet: html => form = html };
  const context = { window: { DATA: { routines } }, App: app, Date, Chores: { today: () => day, days: ['mon','tue','wed','thu','fri','sat','sun'], state: { connected: true, busy: false, message: 'Synced' }, forDate: d => d === day ? tasks : [] } };
  vm.runInNewContext(await readFile(new URL('./views/tasks.js', import.meta.url), 'utf8'), context);
  const el = { addEventListener: (e, f) => listeners[e] = f, innerHTML: '' };
  views.tasks.show(el); assert.match(el.innerHTML, /Morning bed/); assert.doesNotMatch(el.innerHTML, /Read after school/);
  function click(selector, dataset = {}) { listeners.click({ target: { closest: s => s === selector ? { dataset } : null } }); }
  click('[data-r]', { r: 'after' }); assert.match(el.innerHTML, /Read after school/); assert.doesNotMatch(el.innerHTML, /Morning bed/);
  click('[data-edit]'); click('[data-ch]', { ch: 'after1' });
  assert.match(form, /name="people"/); assert.match(form, /name="slots"/); assert.equal((form.match(/name="days"/g) || []).length, 7);
  listeners.change({ target: { matches: () => true, value: '2026-10-17' } }); assert.doesNotMatch(el.innerHTML, /Read after school/); assert.match(el.innerHTML, /Afternoon/); assert.doesNotMatch(el.innerHTML, />After school</);
});

test('one shared Todoist task appears in both lanes with independent checkmarks', async () => {
  const context = { window: { DATA: {} }, Intl, Date, AbortSignal, setInterval() {}, App: { now: () => new Date('2026-10-16T03:00:00Z'), on() {}, emit() {} }, fetch: async () => Response.json({ chores: [{ id: 'bed', title: 'Make bed', people: ['harvey', 'frankie'], days: ['fri'], slots: ['morning', 'evening'], completions: { '2026-10-16': { morning: { harvey: { by: 'harvey' } } } } }], syncedAt: '2026-10-16T03:00:00Z', unmapped: 0 }) };
  vm.runInNewContext(await readFile(new URL('./chores.js', import.meta.url), 'utf8'), context);
  await context.window.Chores.sync();
  const rows = context.window.DATA.chores;
  assert.equal(rows.length, 4); assert.equal(rows[0].taskId, rows[1].taskId); assert.notEqual(rows[0].id, rows[1].id);
  assert.equal(rows.find(c => c.who === 'harvey' && c.r === 'morning').done, true); assert.equal(rows.find(c => c.who === 'frankie').done, false);
  assert.equal(rows.find(c => c.who === 'harvey' && c.r === 'evening').done, false);
});

test('celebrates only a successfully completed child timeslot for today', async () => {
  const views = {}, listeners = {}, rewards = [];
  const day = '2026-10-16', routine = { id: 'morning', name: 'Morning', range: '6–11' };
  const tasks = [1, 2].map(i => ({ id: String(i), taskId: String(i), title: 'Chore', who: 'harvey', r: 'morning', done: false }));
  let succeeds = true;
  const context = { window: { DATA: { routines: [routine] } }, Date,
    Celebrations: { reward: (...args) => rewards.push(args) },
    App: { register: (id, v) => views[id] = v, on() {}, currentRoutine: () => routine, routineName: r => r.name, esc: String, person: id => ({ name: id }), pstyle: () => '', avatar: () => '', ring: () => '', toast() {} },
    Chores: { today: () => day, forDate: d => d === day ? tasks.map(t => ({ ...t })) : [], state: { connected: true, busy: false }, change: async body => { if (succeeds) tasks.find(t => t.id === body.id).done = body.action === 'complete'; return succeeds; } }
  };
  vm.runInNewContext(await readFile(new URL('./views/tasks.js', import.meta.url), 'utf8'), context);
  views.tasks.show({ innerHTML: '', addEventListener: (e, f) => listeners[e] = f });
  async function click(id) {
    listeners.click({ target: { closest: selector => selector === '[data-ch]' ? { dataset: { ch: id } } : null } });
    await new Promise(resolve => setImmediate(resolve));
  }
  await click('1'); assert.equal(rewards.length, 0);
  succeeds = false; await click('2'); assert.equal(rewards.length, 0);
  succeeds = true; await click('2'); assert.equal(rewards.length, 1);
  assert.deepEqual(rewards[0], [day, 'harvey', 'morning', 'harvey', 'Morning']);
  await click('2'); assert.equal(rewards.length, 1);
});

test('reward storage prevents replay after undo or reload and previews do not consume rewards', async () => {
  const stored = {}, queued = [];
  function load() {
    const nodes = [];
    const context = { window: {}, localStorage: { getItem: key => stored[key], setItem: (key, value) => stored[key] = value },
      document: { createElement: () => ({ querySelector: () => ({}), remove() {} }), getElementById: () => ({ appendChild: el => nodes.push(el) }) },
      setTimeout: fn => queued.push(fn), Math, Object, JSON };
    vm.runInNewContext(source, context); return { api: context.window.Celebrations, nodes };
  }
  const source = await readFile(new URL('./celebrations.js', import.meta.url), 'utf8');
  const first = load(); first.api.preview();
  assert.equal(first.api.reward('2026-10-16', 'harvey', 'morning', 'Harvey', 'Morning'), true);
  assert.equal(first.api.reward('2026-10-16', 'harvey', 'morning', 'Harvey', 'Morning'), false);
  const second = load();
  assert.equal(second.api.reward('2026-10-16', 'harvey', 'morning', 'Harvey', 'Morning'), false);
  assert.equal(second.nodes.length, 0);
  assert.equal(second.api.reward('2026-10-16', 'frankie', 'morning', 'Frankie', 'Morning'), true);
  assert.equal(second.api.reward('2026-10-16', 'harvey', 'evening', 'Harvey', 'Evening'), true);
});
