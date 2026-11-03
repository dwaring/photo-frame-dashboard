// Feature-tested support for the iPad mini 3 (iOS 12.5); modern clients retain native APIs.
if (!Promise.allSettled) {
  Promise.allSettled = function (items) {
    return Promise.all(Array.from(items, function (item) {
      return Promise.resolve(item).then(function (value) {
        return { status: 'fulfilled', value: value };
      }, function (reason) { return { status: 'rejected', reason: reason }; });
    }));
  };
}
if (!Object.fromEntries) {
  Object.fromEntries = function (entries) {
    var result = {};
    Array.from(entries).forEach(function (entry) {
      Object.defineProperty(result, entry[0], { value: entry[1], enumerable: true, writable: true, configurable: true });
    });
    return result;
  };
}
// AbortController/AbortSignal are present on iOS 12.5, but timeout() was added later.
if (typeof AbortSignal !== 'undefined' && !AbortSignal.timeout && typeof AbortController !== 'undefined') {
  AbortSignal.timeout = function (ms) {
    var controller = new AbortController();
    setTimeout(function () { controller.abort(); }, ms);
    return controller.signal;
  };
}
