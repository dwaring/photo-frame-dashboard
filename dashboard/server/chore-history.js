import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const root = fileURLToPath(new URL('../../.private/chore-history/', import.meta.url));
// Local development has its own history. Todoist definitions are shared with production.
function path(key) {
  if (!/^chores\/[a-zA-Z0-9]+\/(?:import\.json|completions\/[a-zA-Z0-9]+\/\d{4}-\d{2}-\d{2}\/(?:darren|nadine|harvey|frankie|any)(?:\/(?:morning|after|evening))?)$/.test(key)) throw Error('Invalid history key');
  return join(root, Buffer.from(key).toString('base64url') + '.json');
}
export const localHistory = {
  async get(key) {
    try { const data = JSON.parse(await readFile(path(key), 'utf8')); return { json: async () => data.value }; }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  },
  async list({ prefix }) {
    let files;
    try { files = await readdir(root); } catch (e) { if (e.code === 'ENOENT') return { objects: [], truncated: false }; throw e; }
    const objects = [];
    for (const name of files.filter(n => n.endsWith('.json'))) {
      const key = Buffer.from(name.slice(0, -5), 'base64url').toString();
      if (key.startsWith(prefix)) { const data = JSON.parse(await readFile(join(root, name), 'utf8')); objects.push({ key, customMetadata: data.customMetadata }); }
    }
    return { objects, truncated: false };
  },
  async put(key, value, options = {}) {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const target = path(key), temporary = target + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, JSON.stringify({ value: key.endsWith('/import.json') ? JSON.parse(value) : value, customMetadata: options.customMetadata }), { mode: 0o600 });
    await rename(temporary, target);
  }
};
