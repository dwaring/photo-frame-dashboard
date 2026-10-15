import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

// Never return account identity, credentials, raw errors or arbitrary RPC output.
export function sanitizeUsage(account, quotas, usage, now = Date.now()) {
  const number = n => Number.isFinite(n) && n >= 0 ? n : null;
  const window = w => w && number(w.usedPercent) !== null ? {
    usedPercent: Math.min(100, w.usedPercent),
    windowDurationMins: number(w.windowDurationMins), resetsAt: number(w.resetsAt),
  } : null;
  const buckets = quotas.rateLimitsByLimitId || (quotas.rateLimits ? { codex: quotas.rateLimits } : {});
  return {
    connected: true, source: 'codex-account', syncedAt: new Date(now).toISOString(),
    plan: ['free', 'go', 'plus', 'pro', 'team', 'business', 'enterprise', 'edu'].includes(account.planType) ? account.planType : 'unknown',
    quotas: Object.entries(buckets).slice(0, 20).map(([id, q]) => ({
      id: String(id).slice(0, 80), primary: window(q.primary), secondary: window(q.secondary),
    })),
    summary: Object.fromEntries(['lifetimeTokens', 'peakDailyTokens', 'longestRunningTurnSec', 'currentStreakDays', 'longestStreakDays']
      .map(k => [k, number(usage?.summary?.[k])])),
    daily: Array.isArray(usage?.dailyUsageBuckets) ? usage.dailyUsageBuckets
      .filter(b => /^\d{4}-\d{2}-\d{2}$/.test(b.startDate) && number(b.tokens) !== null)
      .slice(-30).map(b => ({ date: b.startDate, tokens: b.tokens })) : [],
    activityAvailable: !!usage,
  };
}

export async function readUsage({ executable = process.env.CODEX_BIN || 'codex', timeoutMs = 25000, env = process.env } = {}) {
  const child = spawn(executable, ['app-server', '--listen', 'stdio://'], { stdio: ['pipe', 'pipe', 'ignore'], env });
  const pending = new Map();
  let sequence = 0;
  const fail = () => {
    for (const { reject } of pending.values()) reject(new Error('Usage service unavailable'));
    pending.clear();
  };
  child.on('error', fail);
  child.on('exit', fail);
  child.stdin.on('error', fail);
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    if (message.error) call.reject(new Error('Usage request failed'));
    else call.resolve(message.result);
  });
  const send = message => child.stdin.write(JSON.stringify(message) + '\n');
  const rpc = (method, params) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    send({ id, method, ...(params ? { params } : {}) });
  });
  const timer = setTimeout(() => { fail(); child.kill(); }, timeoutMs);
  try {
    await rpc('initialize', { clientInfo: { name: 'home_dashboard_usage', version: '0.1.0' }, capabilities: { experimentalApi: true } });
    send({ method: 'initialized' });
    const { account } = await rpc('account/read', { refreshToken: false });
    if (account?.type !== 'chatgpt') throw new Error('ChatGPT sign-in required');
    const quotas = await rpc('account/rateLimits/read');
    // Older clients/accounts may support quotas but not activity summaries.
    const usage = await rpc('account/usage/read').catch(() => null);
    return sanitizeUsage(account, quotas, usage);
  } finally {
    clearTimeout(timer);
    lines.close();
    child.kill();
  }
}
