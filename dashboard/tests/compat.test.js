import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/compat.js', import.meta.url), 'utf8');
test('legacy APIs handle mixed results, safe object keys and request cancellation', async () => {
  const context = vm.createContext({ setTimeout, AbortController, AbortSignal: class {} });
  vm.runInContext('delete Promise.allSettled; delete Object.fromEntries;', context);
  vm.runInContext(source, context);
  const results = await vm.runInContext('Promise.allSettled([Promise.resolve(4), Promise.reject("offline"), 7])', context);
  assert.equal(JSON.stringify(results), '[{"status":"fulfilled","value":4},{"status":"rejected","reason":"offline"},{"status":"fulfilled","value":7}]');
  assert.equal(vm.runInContext('Object.fromEntries([["__proto__", 3], ["a", 9]]).a', context), 9);
  assert.equal(vm.runInContext('Object.getPrototypeOf(Object.fromEntries([["__proto__", 3]])) === Object.prototype', context), true);
  const signal = vm.runInContext('AbortSignal.timeout(5)', context);
  assert.equal(signal.aborted, false);
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(signal.aborted, true);
});
test('modern implementations stay intact', () => {
  const context = vm.createContext({ setTimeout, AbortController, AbortSignal });
  vm.runInContext('var originalAllSettled = Promise.allSettled; var originalFromEntries = Object.fromEntries;', context);
  const originalTimeout = AbortSignal.timeout;
  vm.runInContext(source, context);
  assert.equal(vm.runInContext('Promise.allSettled === originalAllSettled && Object.fromEntries === originalFromEntries', context), true);
  assert.equal(AbortSignal.timeout, originalTimeout);
});
