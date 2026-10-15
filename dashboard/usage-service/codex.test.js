import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeUsage, readUsage } from './codex.js';

test('usage payload includes metrics but excludes account identity and credentials', () => {
  const result = sanitizeUsage({ planType: 'plus', email: 'private@example.test', tokens: 'secret' }, {
    rateLimitsByLimitId: { codex: { primary: { usedPercent: 42, windowDurationMins: 300, resetsAt: 12345 }, credits: 'private' } },
  }, { summary: { lifetimeTokens: 123, peakDailyTokens: -1 }, dailyUsageBuckets: [
    { startDate: '2026-10-15', tokens: 5 }, { startDate: 'bad', tokens: 8 }, { startDate: '2026-10-14', tokens: -1 },
  ] }, 0);
  assert.equal(result.plan, 'plus');
  assert.equal(result.summary.lifetimeTokens, 123);
  assert.equal(result.summary.peakDailyTokens, null);
  assert.deepEqual(result.daily, [{ date: '2026-10-15', tokens: 5 }]);
  assert.equal(result.quotas[0].primary.usedPercent, 42);
  assert.doesNotMatch(JSON.stringify(result), /private|secret|email|credits/);
});

test('missing metrics remain unavailable rather than becoming zero usage', () => {
  const result = sanitizeUsage({ planType: 'pro' }, { rateLimits: { primary: null } }, null);
  assert.equal(result.summary.lifetimeTokens, null);
  assert.equal(result.activityAvailable, false);
  assert.equal(result.quotas[0].primary, null);
  assert.deepEqual(result.daily, []);
});

test('missing Codex executable fails without leaking process or auth details', async () => {
  await assert.rejects(readUsage({ executable: '/nonexistent/dashboard-codex', timeoutMs: 1000 }), /^Error: Usage service unavailable$/);
});
