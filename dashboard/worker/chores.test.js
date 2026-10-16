import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todoist } from './todoist.js';
import { readHistory, completionKey } from './chore-history.js';
import { displayChore } from './chores.js';
const objects = new Map();
const bucket = {
  async get(key) { return objects.has(key) ? { json: async () => JSON.parse(objects.get(key).body) } : null; },
  async put(key, body, options) { objects.set(key, { body, customMetadata: options?.customMetadata }); },
  async list({ prefix }) { return { objects: [...objects].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, customMetadata: value.customMetadata })), truncated: false }; }
};
const env = { TODOIST_API_TOKEN: 'secret', TODOIST_CHORES_PROJECT_ID: 'chores', CHORE_HISTORY: bucket };
const origin = 'https://home.example';
const task = { id: 'chore1', project_id: 'chores', content: 'Make bed', labels: ['person_harvey', 'person_frankie', 'stars_2', 'slot_morning', 'slot_evening', 'day_fri', 'keep'], description: 'Keep my notes' };
function request(body, headers = {}) { return new Request(origin + '/api/todoist/chores', { method: body ? 'POST' : 'GET', headers: { 'Cf-Access-Jwt-Assertion': 'test', Origin: origin, ...headers }, body: body ? JSON.stringify(body) : undefined }); }
test('maps only explicitly assigned and scheduled chores', () => {
  const c = displayChore(task); assert.deepEqual(c.people, ['harvey', 'frankie']); assert.deepEqual(c.slots, ['morning', 'evening']); assert.deepEqual(c.days, ['fri']); assert.equal(c.stars, 2);
  assert.equal(displayChore({ ...task, labels: [] }), null);
  assert.equal(displayChore({ ...task, labels: [...task.labels, 'person_any'] }), null);
  assert.equal(displayChore({ ...task, is_uncompletable: true }), null);
});
test('requires Access, chores configuration, and same-origin writes independently of shopping', async () => {
  assert.equal((await todoist(new Request(origin + '/api/todoist/chores'), env)).status, 401);
  assert.equal((await todoist(request(), {})).status, 503);
  assert.equal((await todoist(request({ action: 'save' }, { Origin: 'https://other.example' }), env)).status, 403);
});
test('scopes, paginates and reports unmapped tasks', async () => {
  const original = globalThis.fetch; let count = 0;
  globalThis.fetch = async url => { const u = new URL(url); assert.equal(u.searchParams.get('project_id'), 'chores'); count++; return Response.json({ results: count === 1 ? [task] : [{ ...task, labels: [] }], next_cursor: count === 1 ? 'next' : null }); };
  try { const data = await (await todoist(request(), env)).json(); assert.equal(data.chores.length, 1); assert.equal(data.unmapped, 1); assert.equal(count, 2); assert.equal(data.chores[0].description, undefined); }
  finally { globalThis.fetch = original; }
});
test('shared task records independent completions without changing Todoist descriptions', async () => {
  objects.clear();
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.method, 'GET', 'Completion must never update the Todoist task');
    return url.includes('?') ? Response.json({ results: [task] }) : Response.json(task);
  };
  try {
    const body = { action: 'complete', id: 'chore1', date: '2026-10-09', person: 'harvey', by: 'harvey', r: 'morning' };
    assert.equal((await todoist(request(body), env)).status, 200);
    assert.equal((await todoist(request(body), env)).status, 200);
    assert.equal((await todoist(request({ ...body, person: 'frankie', by: 'frankie' }), env)).status, 200);
    let data = await (await todoist(request(), env)).json();
    assert.deepEqual(data.chores[0].completions[body.date].morning, { harvey: { by: 'harvey', stars: 2 }, frankie: { by: 'frankie', stars: 2 } });
    assert.equal((await todoist(request({ ...body, by: 'frankie' }), env)).status, 400);
    assert.equal((await todoist(request({ ...body, date: '2099-01-02' }), env)).status, 400);
    assert.equal((await todoist(request({ ...body, date: '2026-10-10' }), env)).status, 400);
    assert.equal((await todoist(request({ ...body, r: 'evening' }), env)).status, 200);
    assert.equal((await todoist(request({ ...body, action: 'reopen' }), env)).status, 200);
    data = await (await todoist(request(), env)).json();
    assert.deepEqual(data.chores[0].completions[body.date].morning, { frankie: { by: 'frankie', stars: 2 } });
    assert.deepEqual(data.chores[0].completions[body.date].evening, { harvey: { by: 'harvey', stars: 2 } });
  } finally { globalThis.fetch = original; }
});
test('cannot edit or complete another project task', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => { assert.equal(options.method, 'GET'); return Response.json({ ...task, project_id: 'shopping' }); };
  try { for (const action of ['save', 'complete', 'reopen']) assert.equal((await todoist(request({ action, id: 'chore1' }), env)).status, 403); }
  finally { globalThis.fetch = original; }
});
test('edits assignments while retaining unrelated labels, notes and completion history', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (options.method === 'GET') return Response.json(task);
    const update = JSON.parse(options.body);
    assert.deepEqual(update.labels, ['keep', 'person_harvey', 'person_frankie', 'stars_2', 'slot_after', 'day_mon', 'day_sat']);
    assert.equal(update.description, undefined); return Response.json(update);
  };
  try {
    const body = { action: 'save', id: 'chore1', title: 'Read', people: ['harvey', 'frankie'], slots: ['after'], days: ['mon', 'sat'], stars: 2 };
    assert.equal((await todoist(request(body), env)).status, 200);
    assert.equal((await todoist(request({ ...body, days: [] }), env)).status, 400);
  } finally { globalThis.fetch = original; }
});

test('imported completions survive cleanup and can be reopened with paginated storage', async () => {
  objects.clear();
  const hit = { task: 'chore1', date: '2026-10-09', person: 'harvey', by: 'harvey', r: 'morning', stars: 2 };
  objects.set('chores/chores/import.json', { body: JSON.stringify([hit]) });
  assert.deepEqual(await readHistory(bucket, 'chores'), [hit]);
  objects.set(completionKey('chores', hit.task, hit.date, hit.person, hit.slot), { customMetadata: { done: 'false', by: hit.by, stars: '2' } });
  assert.deepEqual(await readHistory(bucket, 'chores'), []);
  const paged = { get: async () => null, list: async options => options.cursor ? { objects: [{ key: completionKey('chores', 'chore1', '2026-10-09', 'frankie'), customMetadata: { done: 'true', by: 'frankie', stars: '2' } }], truncated: false } : { objects: [], truncated: true, cursor: 'next' } };
  assert.equal((await readHistory(paged, 'chores'))[0].by, 'frankie');
  objects.clear();
});
