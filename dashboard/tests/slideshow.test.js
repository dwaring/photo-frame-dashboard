import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function slideshow(photos, layout) {
  const App = { on() {}, fmt: { date() { return ''; } }, now() { return new Date(); }, person() {} };
  vm.runInNewContext(fs.readFileSync(new URL('../js/slideshow.js', import.meta.url), 'utf8'), { App, window: { DATA: { photos } }, setInterval, clearInterval });
  return new App.Slideshow({}, { layout });
}
const photo = id => ({ id, o: 'l', tag: 'import', source: 'google-photos', date: '' });
test('Pair uses distinct landscape imports', () => {
  const slide = slideshow([photo('a'), photo('b')], 'pair').pick();
  assert.equal(slide.layout, 'pair');
  assert.equal(new Set(slide.photos.map(p => p.id)).size, 2);
});
test('Collage uses distinct imports across cycles', () => {
  const show = slideshow([photo('a'), photo('b'), photo('c')], 'collage');
  for (let i = 0; i < 10; i++) {
    const slide = show.pick();
    assert.equal(slide.layout, 'collage');
    assert.equal(new Set(slide.photos.map(p => p.id)).size, 3);
  }
});
test('Insufficient photos fall back safely', () => {
  for (const layout of ['pair', 'collage']) {
    const slide = slideshow([photo('a')], layout).pick();
    assert.equal(slide.layout, 'cover');
    assert.equal(slide.photos[0].id, 'a');
  }
});
