import test from 'node:test';
import assert from 'node:assert/strict';
import { stageGeometry } from '../js/stage-geometry.js';

test('iPad landscape fills the viewport with no oversized scaled canvas', () => {
  const result = stageGeometry(1024, 768);
  assert.equal(1280 * result.scale, 1024);
  assert.equal(result.height * result.scale, 768);
  assert.ok(result.height > 800, 'use the extra 4:3 height for content');
});
test('other viewport sizes contain the stage without cropping', () => {
  for (const [width, height] of [[1280, 800], [1920, 1080], [768, 1024], [1024, 640]]) {
    const result = stageGeometry(width, height);
    assert.ok(1280 * result.scale <= width + 0.001);
    assert.ok(Math.abs(result.height * result.scale - height) < 0.001);
    assert.ok(result.height >= 800);
  }
});
