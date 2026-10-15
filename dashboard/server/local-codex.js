import { access, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const usable = async path => { try { await access(path, constants.X_OK); return true; } catch { return false; } };

// Finder-launched terminals do not inherit the IDE's extension binary in PATH.
export async function findLocalCodex(env = process.env, home = homedir()) {
  if (env.CODEX_BIN) return env.CODEX_BIN;
  for (const directory of (env.PATH || '').split(delimiter).filter(Boolean)) {
    const path = join(directory, 'codex');
    if (await usable(path)) return path;
  }
  const platform = process.platform === 'darwin' ? 'macos' : process.platform;
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
  for (const editor of ['.vscode', '.cursor']) {
    const root = join(home, editor, 'extensions');
    const entries = await readdir(root).catch(() => []);
    for (const entry of entries.filter(name => name.startsWith('openai.chatgpt-')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) {
      const path = join(root, entry, 'bin', platform + '-' + arch, 'codex');
      if (await usable(path)) return path;
    }
  }
  return 'codex';
}

export async function localCodexOptions() {
  const env = { ...process.env };
  const serviceHome = fileURLToPath(new URL('../../.private/chatgpt-hosted/', import.meta.url));
  // Reuse the separate account the user already signed in for this dashboard.
  try { await access(join(serviceHome, 'auth.json')); env.CODEX_HOME = serviceHome; } catch { /* Use the normal CLI session. */ }
  return { executable: await findLocalCodex(), env };
}
