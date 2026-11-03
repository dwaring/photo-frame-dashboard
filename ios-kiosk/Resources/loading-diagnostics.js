(function () {
  // No page text, form data, cookies, headers or URL query strings are collected.
  var stage = document.getElementById('stage');
  var style = stage ? getComputedStyle(stage) : null;
  var report = window.__homeKioskLoading = {
    ready: document.readyState, appPresent: !!window.App,
    stageDisplay: style ? style.display : 'missing',
    stagePosition: style ? style.position : 'missing',
    cssFiles: document.styleSheets.length, assets: []
  };
  var bounds = stage ? stage.getBoundingClientRect() : null;
  report.viewport = { width: innerWidth, height: innerHeight, scrollX: pageXOffset, scrollY: pageYOffset };
  if (bounds) report.stageBounds = { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
  var tags = document.querySelectorAll('script[src],link[rel="stylesheet"]');
  Array.prototype.forEach.call(tags, function (tag) {
    var link = document.createElement('a');
    link.href = tag.src || tag.href;
    if (link.host !== location.host || !/^\/assets\/[\w.-]+\.(css|js)$/.test(link.pathname)) return;
    var item = { path: link.pathname, state: 'pending' };
    report.assets.push(item);
    if (tag.sheet) {
      try { item.rules = tag.sheet.cssRules.length; }
      catch (_) { item.rules = 'inaccessible'; }
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', link.pathname, true);
    xhr.withCredentials = true;
    xhr.timeout = 8000;
    xhr.onload = function () {
      item.state = 'received'; item.status = xhr.status;
      var mime = (xhr.getResponseHeader('Content-Type') || '').split(';')[0];
      item.mime = /^(text\/css|text\/html|text\/javascript|application\/javascript)$/.test(mime) ? mime : 'other';
      item.bytes = xhr.responseText.length;
      item.htmlResponse = /^\s*</.test(xhr.responseText);
      var destination = document.createElement('a'); destination.href = xhr.responseURL;
      item.redirectedToOtherHost = destination.host !== location.host;
      if (item.status === 200 && !item.htmlResponse && /\.js$/.test(item.path)) {
        try { new Function(xhr.responseText); item.syntax = 'accepted'; }
        catch (error) { item.syntax = error.name === 'SyntaxError' ? 'SyntaxError' : 'other-error'; }
      }
      if (item.status === 200 && !item.htmlResponse && /\.css$/.test(item.path)) {
        var test = document.createElement('style');
        test.media = 'not all'; test.textContent = xhr.responseText;
        document.head.appendChild(test);
        try { item.parsedCSSRules = test.sheet.cssRules.length; }
        catch (_) { item.parsedCSSRules = 'inaccessible'; }
        test.remove();
      }
    };
    xhr.onerror = function () { item.state = 'network-or-CORS-error'; };
    xhr.ontimeout = function () { item.state = 'timeout'; };
    xhr.send();
  });
  return JSON.stringify(report);
})();
