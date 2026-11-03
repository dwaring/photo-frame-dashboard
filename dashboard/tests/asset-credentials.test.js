import test from 'node:test';
import assert from 'node:assert/strict';
import { credentialedAssets } from '../server/asset-credentials.js';

test('production modules, styles and preloads retain the Access session', () => {
  const source = '<script type="module" crossorigin src="/assets/app.js"></script>\n' +
    '<link rel="stylesheet" crossorigin="anonymous" href="/assets/app.css">\n' +
    '<link rel="modulepreload" href="/assets/chunk.js">';
  const result = credentialedAssets(source);
  assert.equal((result.match(/crossorigin="use-credentials"/g) || []).length, 3);
  assert.equal(result.includes('anonymous'), false);
  assert.equal(credentialedAssets(result), result);
});
test('external fonts and resources do not receive dashboard credentials', () => {
  const source = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<script crossorigin="anonymous" src="https://example.com/script.js"></script>';
  assert.equal(credentialedAssets(source), source);
});
