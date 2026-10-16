import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todoist, displayTask } from './todoist.js';
const origin = 'https://dashboard.example';
const env = { TODOIST_API_TOKEN: 'test-token', TODOIST_PROJECT_ID: 'shopping' };
function request(method = 'GET', body, headers = {}) {
  return new Request(origin + '/api/todoist/tasks', { method, headers: { 'Cf-Access-Jwt-Assertion': 'test', Origin: origin, ...headers }, body: body ? JSON.stringify(body) : undefined });
}
test('requires Access and configuration', async () => {
  assert.equal((await todoist(new Request(origin + '/api/todoist/tasks'), env)).status, 401);
  assert.equal((await todoist(request(), {})).status, 503);
});
test('rejects cross-origin mutations', async () => {
  assert.equal((await todoist(request('POST', { action: 'add', name: 'Milk' }, { Origin: 'https://other.example' }), env)).status, 403);
});
test('paginates the selected project and returns only display fields', async () => {
  const original = globalThis.fetch; let count = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).searchParams.get('project_id'), 'shopping');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    count++;
    if (count === 2) assert.equal(new URL(url).searchParams.get('cursor'), 'next');
    return Response.json({ results: [{ id: String(count), content: 'Item', description: 'Note', privateField: 'hidden' }], next_cursor: count === 1 ? 'next' : null });
  };
  try {
    const r = await todoist(request(), env), data = await r.json();
    assert.equal(data.tasks.length, 2); assert.equal(data.tasks[0].privateField, undefined);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  } finally { globalThis.fetch = original; }
});
test('cannot complete a task in another project', async () => {
  const original = globalThis.fetch; let count = 0;
  globalThis.fetch = async () => { count++; return Response.json({ project_id: 'other' }); };
  try {
    assert.equal((await todoist(request('POST', { action: 'complete', id: 'task1' }), env)).status, 403);
    assert.equal(count, 1);
  } finally { globalThis.fetch = original; }
});
test('creates tasks only in the configured project', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (options.method === 'GET') return Response.json({ results: [], next_cursor: null });
    assert.equal(url, 'https://api.todoist.com/api/v1/tasks');
    assert.deepEqual(JSON.parse(options.body), { content: 'Milk', project_id: 'shopping' });
    return Response.json({ id: 'new' });
  };
  try { assert.equal((await todoist(request('POST', { action: 'add', name: ' Milk ', project_id: 'other' }), env)).status, 200); }
  finally { globalThis.fetch = original; }
});
test('quantities and stores round-trip without consuming notes', () => {
  assert.deepEqual(displayTask({ id: 'x', content: 'Milk ×3', description: 'Full cream', labels: ['amazon'] }), {
    id: 'x', name: 'Milk', qty: 3, note: 'Full cream', store: 'amazon', uncompletable: false, recurring: false
  });
  assert.equal(displayTask({ content: 'Milk 2L' }).name, 'Milk 2L');
});
test('staples are separate and never returned as shopping tasks', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => Response.json({ results: [{ id: new URL(url).searchParams.get('project_id'), content: 'Milk' }], next_cursor: null });
  try {
    const data = await (await todoist(request(), { ...env, TODOIST_STAPLES_PROJECT_ID: 'staples' })).json();
    assert.equal(data.tasks[0].id, 'shopping'); assert.equal(data.staples[0].id, 'staples');
  } finally { globalThis.fetch = original; }
});
test('adding a staple copies its notes and labels without modifying the template', async () => {
  const original = globalThis.fetch; const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([url, options]);
    if (url.endsWith('/tasks/template')) return Response.json({ content: 'Coffee ×2', description: 'Whole beans', labels: ['amazon', 'coffee'], project_id: 'staples' });
    if (options.method === 'GET') return Response.json({ results: [], next_cursor: null });
    assert.deepEqual(JSON.parse(options.body), { content: 'Coffee ×2', description: 'Whole beans', labels: ['coffee'], project_id: 'shopping' });
    return Response.json({ id: 'copy' });
  };
  try {
    assert.equal((await todoist(request('POST', { action: 'add', stapleId: 'template', store: 'grocer' }), { ...env, TODOIST_STAPLES_PROJECT_ID: 'staples' })).status, 200);
    assert.equal(calls.filter(c => c[1].method === 'POST').length, 1);
  } finally { globalThis.fetch = original; }
});
test('repeated add does not duplicate an active item', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.method, 'GET');
    return Response.json({ results: [{ id: 'existing', content: 'Milk ×2' }], next_cursor: null });
  };
  try {
    const data = await (await todoist(request('POST', { action: 'add', name: 'Milk' }), env)).json();
    assert.equal(data.alreadyOnList, true);
  } finally { globalThis.fetch = original; }
});
test('quantity updates preserve the task and description, and reject invalid values', async () => {
  const original = globalThis.fetch; let updates = 0;
  globalThis.fetch = async (url, options) => {
    if (options.method === 'GET') return Response.json({ project_id: 'shopping', content: 'Milk ×2', description: 'Keep this' });
    assert.deepEqual(JSON.parse(options.body), { content: 'Milk ×3' }); updates++;
    return Response.json({});
  };
  try {
    assert.equal((await todoist(request('POST', { action: 'quantity', id: 'item', qty: 3 }), env)).status, 200);
    assert.equal((await todoist(request('POST', { action: 'quantity', id: 'item', qty: 0 }), env)).status, 400);
    assert.equal(updates, 1);
  } finally { globalThis.fetch = original; }
});
test('staple templates and unrelated tasks cannot be completed, reopened, or changed', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => { assert.equal(options.method, 'GET'); return Response.json({ project_id: 'staples' }); };
  try {
    for (const action of ['complete', 'reopen', 'quantity']) assert.equal((await todoist(request('POST', { action, id: 'item', qty: 2 }), env)).status, 403);
  } finally { globalThis.fetch = original; }
});
