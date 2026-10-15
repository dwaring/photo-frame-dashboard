import { DurableObject } from 'cloudflare:workers';

export class ChatgptUsage extends DurableObject {
  pending;
  constructor(ctx, env) {
    super(ctx, env);
    if (ctx.container?.running) ctx.blockConcurrencyWhile(() => ctx.container.setInactivityTimeout(60000));
  }

  // Internal binding RPC only. No fetch method or public credential routes.
  async usage() {
    if (!this.pending) this.pending = this.read().finally(() => { this.pending = null; });
    return this.pending;
  }

  async read() {
    const seed = this.env.CODEX_AUTH_JSON;
    if (!seed) return { connected: false, reason: 'not-configured' };
    const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed))))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const previous = await this.ctx.storage.get('seed');
    const container = this.ctx.container;
    if (previous !== fingerprint) {
      if (container.running) await container.destroy();
      await this.ctx.storage.put({ seed: fingerprint, auth: seed });
      await this.ctx.storage.delete('cache');
    }
    const cached = await this.ctx.storage.get('cache');
    if (cached && Date.now() - Date.parse(cached.syncedAt) < 120000) return cached;
    let key = await this.ctx.storage.get('key');
    if (!key) { key = crypto.randomUUID() + crypto.randomUUID(); await this.ctx.storage.put('key', key); }
    if (!container.running) {
      container.start({
        image: container.images.base, instance: 'lite', enableInternet: true,
        env: { USAGE_BIND: '0.0.0.0', PORT: '8080', CODEX_HOME: '/tmp/codex',
          CODEX_AUTH_JSON: await this.ctx.storage.get('auth'), USAGE_SERVICE_KEY: key },
      });
    }
    await container.setInactivityTimeout(60000);
    const port = container.getTcpPort(8080);
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const response = await port.fetch('http://container/health', { signal: AbortSignal.timeout(1000) });
        ready = response.ok;
        await response.body?.cancel();
        if (ready) break;
      } catch { /* Startup may still be in progress. */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error('Usage container unavailable');
    const response = await port.fetch('http://container/internal/snapshot', {
      headers: { Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error('Usage unavailable');
    const snapshot = await response.json();
    if (typeof snapshot.auth !== 'string') throw new Error('Invalid usage response');
    await this.ctx.storage.put('auth', snapshot.auth);
    if (!snapshot.usage?.connected) throw new Error('Usage unavailable');
    // Persist the rotated refresh token before exposing the successful sync.
    await this.ctx.storage.put({ auth: snapshot.auth, cache: snapshot.usage });
    return snapshot.usage;
  }
}
