// Private manual imports. OAuth tokens never leave the Worker or persist after import.
const root = '/api/google-photos';
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const redirect = (location, cookie) => new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
const read = async (bucket, key) => { const o = await bucket.get(key); return o ? o.json() : null; };
const save = (bucket, key, data) => bucket.put(key, JSON.stringify(data));
const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2, '0')).join('');
const cookie = value => 'photos_state=' + value + '; Secure; HttpOnly; SameSite=Lax; Path=' + root + '; Max-Age=600';
const page = () => new Response(`<!doctype html><meta charset="utf-8"><meta name="referrer" content="same-origin"><title>Import Google Photos</title>
<style>body{font:18px system-ui;max-width:700px;margin:50px auto;padding:24px}button,a{margin:12px;padding:12px;display:inline-block}</style>
<h1>Import Google Photos</h1><p>Choose up to 100 photos in Google Photos, press Done, then return here and import. Videos are skipped. A completed import replaces the dashboard selection. This does not sync future album changes.</p>
<p id="status">Checking configuration…</p><a href="${root}/connect">Connect Google account</a><button id="pick">Choose photos</button><button id="import">Import selection</button><p><a href="/">Back to dashboard</a></p>
<script src="${root}/setup.js"></script>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" } });
const script = `const status=document.querySelector('#status');async function api(route,method='GET',body){const r=await fetch('/api/google-photos/'+route,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d}async function run(fn){try{document.querySelectorAll('button').forEach(b=>b.disabled=true);await fn()}catch(e){status.textContent=e.message}finally{document.querySelectorAll('button').forEach(b=>b.disabled=false)}}api('status').then(d=>status.textContent=!d.configured?'Hosted Google Photos setup is required. See docs/google-photos.md.':d.count+' imported photos. '+(d.connected?'Ready to choose photos.':'Connect your Google account to import.')).catch(()=>status.textContent='Sign in to the hosted dashboard first.');document.querySelector('#pick').onclick=()=>run(async()=>{const d=await api('pick','POST');location.href=d.pickerUri});document.querySelector('#import').onclick=()=>run(async()=>{const d=await api('prepare','POST');for(let i=0;i<d.count;i++){status.textContent='Importing photo '+(i+1)+' of '+d.count+'…';await api('import','POST',{index:i})}await api('finish','POST');status.textContent='Import complete. Return to the dashboard.'});`;

export async function googlePhotos(request, env) {
  const url = new URL(request.url), route = url.pathname.slice(root.length);
  // Access must protect the entire hostname; never enable this on a public Worker.
  if (!request.headers.get('Cf-Access-Jwt-Assertion')) return json({ error: 'Dashboard sign-in required' }, 401);
  const configured = !!(env.PHOTOS && env.GOOGLE_PHOTOS_CLIENT_ID && env.GOOGLE_PHOTOS_CLIENT_SECRET);
  if (route === '/setup' && request.method === 'GET') return page();
  if (route === '/setup.js' && request.method === 'GET') return new Response(script, { headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' } });
  if (route === '/status' && request.method === 'GET') {
    const manifest = env.PHOTOS && await read(env.PHOTOS, 'manifest');
    const identity = request.headers.get('Cf-Access-Authenticated-User-Email');
    const auth = configured && identity && await read(env.PHOTOS, 'auth/' + await digest(identity));
    return json({ configured, connected: !!(auth && auth.expires > Date.now()), count: manifest?.photos?.length || 0 });
  }
  if (!configured) return json({ error: 'Google Photos is not configured. See docs/google-photos.md.' }, 503);
  if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) return json({ error: 'Invalid origin' }, 403);
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
  const bucket = env.PHOTOS;
  const identity = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (!identity) return json({ error: 'Access email identity required' }, 401);
  const authKey = 'auth/' + await digest(identity);
  const callback = url.origin + root + '/callback';
  async function token(params) {
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: env.GOOGLE_PHOTOS_CLIENT_ID, client_secret: env.GOOGLE_PHOTOS_CLIENT_SECRET, ...params }), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw Error('Google authorization failed. Connect again.');
    const t = await r.json(); return { token: t.access_token, expires: Date.now() + t.expires_in * 1000 };
  }
  try {
    if (route === '/connect' && request.method === 'GET') {
      const state = crypto.randomUUID(), verifier = crypto.randomUUID() + crypto.randomUUID();
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
      const challenge = btoa(String.fromCharCode(...hash)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      await save(bucket, 'oauth/' + state, { verifier, authKey, expires: Date.now() + 600000 });
      return redirect('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: env.GOOGLE_PHOTOS_CLIENT_ID, redirect_uri: callback, response_type: 'code', scope: 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly', state, code_challenge: challenge, code_challenge_method: 'S256' }), cookie(state));
    }
    if (route === '/callback' && request.method === 'GET') {
      const state = url.searchParams.get('state');
      if (!/^[a-f0-9-]{36}$/.test(state || '')) throw Error('Authorization expired. Connect again.');
      const attempt = await read(bucket, 'oauth/' + state);
      if (!attempt || attempt.authKey !== authKey || attempt.expires < Date.now() || !request.headers.get('Cookie')?.split(';').some(c => c.trim() === 'photos_state=' + state)) throw Error('Authorization expired. Connect again.');
      await bucket.delete('oauth/' + state);
      if (!url.searchParams.get('code')) throw Error('Google authorization cancelled.');
      await save(bucket, authKey, await token({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: callback, code_verifier: attempt.verifier }));
      return redirect(root + '/setup', cookie(''));
    }
    if (route === '/list' && request.method === 'GET') return json(await read(bucket, 'manifest') || { photos: [] });
    if (route.startsWith('/image/') && request.method === 'GET') {
      const id = route.slice(7);
      if (!/^[a-f0-9-]{36}$/.test(id)) return json({ error: 'Unknown photo' }, 404);
      const object = await bucket.get('images/' + id);
      if (!object) return json({ error: 'Unknown photo' }, 404);
      return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    if (request.method !== 'POST') return json({ error: 'Unknown route' }, 404);
    const auth = await read(bucket, authKey);
    if (!auth || auth.expires < Date.now()) throw Error('Google authorization expired. Connect again. Imported photos are retained.');
    async function api(path, method = 'GET', body) {
      const r = await fetch('https://photospicker.googleapis.com/v1/' + path, { method, headers: { Authorization: 'Bearer ' + auth.token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw Error('Google Photos request failed. Reconnect or choose photos again.');
      return method === 'DELETE' ? null : r.json();
    }
    if (route === '/pick') {
      if (auth.session) await api('sessions/' + encodeURIComponent(auth.session), 'DELETE');
      const s = await api('sessions', 'POST', { pickingConfig: { maxItemCount: '100' } });
      await save(bucket, authKey, { token: auth.token, expires: auth.expires, session: s.id });
      return json({ pickerUri: s.pickerUri });
    }
    if (!auth.session) throw Error('Choose photos first.');
    const session = 'sessions/' + encodeURIComponent(auth.session);
    if (route === '/prepare') {
      const s = await api(session);
      if (!s.mediaItemsSet) throw Error('Finish choosing photos in Google Photos and press Done first.');
      const items = []; let next;
      do {
        const p = await api('mediaItems?' + new URLSearchParams({ sessionId: auth.session, pageSize: '100', ...(next ? { pageToken: next } : {}) }));
        items.push(...(p.mediaItems || []).filter(p => p.type === 'PHOTO')); next = p.nextPageToken;
        if (items.length > 100) throw Error('Select at most 100 photos.');
      } while (next);
      if (!items.length) throw Error('No supported photos selected. Videos are skipped.');
      auth.items = items; auth.imported = []; await save(bucket, authKey, auth);
      return json({ count: items.length });
    }
    if (route === '/import') {
      const { index } = await request.json();
      if (!Number.isInteger(index) || !auth.items?.[index] || index > (auth.imported?.length || 0)) throw Error('Invalid import position. Start import again.');
      if (auth.imported[index]) return json({ ok: true });
      const item = auth.items[index], file = item.mediaFile, target = new URL(file.baseUrl);
      if (target.protocol !== 'https:' || !target.hostname.endsWith('.googleusercontent.com')) throw Error('Invalid Google image URL.');
      // Workers supports manual redirects; reject 3xx below without forwarding the token.
      const r = await fetch(target.href + '=w1600-h1200', { headers: { Authorization: 'Bearer ' + auth.token }, redirect: 'manual', signal: AbortSignal.timeout(30000) });
      if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(r.headers.get('Content-Type') || '')) throw Error('Photo download failed. Retry import.');
      const bytes = await r.arrayBuffer();
      if (bytes.byteLength > 20 * 1024 * 1024) throw Error('Photo is too large.');
      const id = crypto.randomUUID();
      await bucket.put('images/' + id, bytes, { httpMetadata: { contentType: r.headers.get('Content-Type') } });
      auth.imported.push({ id, src: root + '/image/' + id, o: Number(file.mediaFileMetadata?.height) > Number(file.mediaFileMetadata?.width) ? 'p' : 'l', date: item.createTime?.slice(0, 10) || '', place: 'Google Photos', tag: 'import', source: 'google-photos' });
      await save(bucket, authKey, auth); return json({ ok: true });
    }
    if (route === '/finish') {
      if (!auth.items?.length || auth.imported?.length !== auth.items.length) throw Error('Complete the import first.');
      const previous = await read(bucket, 'manifest');
      await save(bucket, 'manifest', { importedAt: new Date().toISOString(), photos: auth.imported });
      await api(session, 'DELETE'); await bucket.delete(authKey);
      if (previous?.photos) await bucket.delete(previous.photos.map(p => 'images/' + p.id));
      return json({ ok: true });
    }
    return json({ error: 'Unknown route' }, 404);
  } catch (e) {
    return json({ error: e.message || 'Photo import failed' }, 400);
  }
}
