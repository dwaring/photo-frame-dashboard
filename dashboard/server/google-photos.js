import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Private local copies are never included in the build or served by Vite's file server.
export function localPhotos() {
  const directory = fileURLToPath(new URL('../../.private/photos/', import.meta.url));
  function configure(server) {
    server.middlewares.use(async (req, res, next) => {
      const path = (req.url || '').split('?')[0];
      if (!path.startsWith('/api/google-photos/')) return next();
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host || '') || req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host)) {
        res.statusCode = 403; return res.end('Forbidden');
      }
      if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
      try {
        const manifest = JSON.parse(await readFile(directory + 'manifest.json', 'utf8'));
        if (path === '/api/google-photos/list') {
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify(manifest));
        }
        const id = path.slice('/api/google-photos/image/'.length);
        if (!path.startsWith('/api/google-photos/image/') || !/^[a-f0-9-]{36}$/.test(id) || !manifest.photos.some(p => p.id === id)) { res.statusCode = 404; return res.end(); }
        const image = await readFile(directory + id);
        // Imported Google Photos files may be JPEG, PNG or WebP.
        res.setHeader('Content-Type', image[0] === 0x89 ? 'image/png' : image.toString('ascii', 0, 4) === 'RIFF' ? 'image/webp' : 'image/jpeg');
        res.end(image);
      } catch (e) {
        if (e.code === 'ENOENT' && path.endsWith('/list')) {
          res.setHeader('Content-Type', 'application/json'); return res.end('{"photos":[]}');
        }
        res.statusCode = 503; res.end('Local photos unavailable');
      }
    });
  }
  return { name: 'local-private-photos', configureServer: configure, configurePreviewServer: configure };
}
