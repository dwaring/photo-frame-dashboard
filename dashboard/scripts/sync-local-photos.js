import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const directory = new URL('../../.private/photos/', import.meta.url);
await mkdir(directory, { recursive: true, mode: 0o700 });
const get = (key, file) => execFileSync('npx', ['wrangler', 'r2', 'object', 'get', 'home-dashboard-photos/' + key, '--remote', '--file', file.pathname], { stdio: 'pipe' });
get('manifest', new URL('pending.json', directory));
const manifest = JSON.parse(await readFile(new URL('pending.json', directory), 'utf8'));
for (const [index, photo] of manifest.photos.entries()) {
  if (!/^[a-f0-9-]{36}$/.test(photo.id)) throw Error('Invalid photo ID');
  get('images/' + photo.id, new URL(photo.id, directory));
  console.log('Downloaded photo ' + (index + 1) + '/' + manifest.photos.length);
}
// Publish only after every image is available; an interrupted sync retains the old selection.
await writeFile(new URL('pending.json', directory), JSON.stringify(manifest), { mode: 0o600 });
await rename(new URL('pending.json', directory), new URL('manifest.json', directory));
console.log('Local photo selection ready.');
