import test from 'node:test';
import assert from 'node:assert/strict';
import { isQuietTime } from '../js/night-mode.js';
test('Adelaide quiet hours include 22:30 and end exactly at 06:00', () => {
  for (const [time, expected] of [['22:29', false], ['22:30', true], ['23:59', true], ['00:00', true], ['05:59', true], ['06:00', false], ['12:00', false]]) {
    assert.equal(isQuietTime(new Date('2026-11-03T' + time + ':00+10:30')), expected, time);
  }
});
test('Schedule follows Adelaide winter offset too', () => {
  assert.equal(isQuietTime(new Date('2026-06-03T22:30:00+09:30')), true);
  assert.equal(isQuietTime(new Date('2026-06-03T06:00:00+09:30')), false);
});
