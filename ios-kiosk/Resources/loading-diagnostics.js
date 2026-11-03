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
  // Calendar diagnostics contain only connection flags and aggregate event counts.
  report.calendar = {};
  function calendarRequest(path, done) {
    var request = new XMLHttpRequest();
    request.open('GET', '/api/google-calendar/' + path, true);
    request.withCredentials = true; request.timeout = 60000;
    request.onload = function () {
      var data;
      try { data = JSON.parse(request.responseText); } catch (_) {}
      done(request.status, data);
    };
    request.onerror = function () { done(0, null); };
    request.ontimeout = function () { done(0, null); };
    request.send();
  }
  calendarRequest('status', function (status, data) {
    report.calendar.statusHTTP = status;
    if (!data) { report.calendar.response = 'not-json'; return; }
    report.calendar.configured = !!data.configured;
    report.calendar.connected = !!data.connected;
    report.calendar.selected = !!data.selected;
    if (!data.selected) return;
    calendarRequest('events', function (status, data) {
      report.calendar.eventsHTTP = status;
      if (data && Array.isArray(data.events)) {
        report.calendar.eventCount = data.events.length;
        report.calendar.invalidDates = data.events.filter(function (event) {
          return isNaN(new Date(event.allDay ? event.start + 'T00:00:00' : event.start).getTime());
        }).length;
      } else if (data && typeof data.error === 'string') {
        report.calendar.reconnectRequired = /[Rr]econnect|[Aa]uthorization|[Cc]onnect your Google/.test(data.error);
        var codes = ['reauthorization-required', 'google-oauth-failed', 'calendar-access-denied', 'calendar-api-failed', 'calendar-unavailable'];
        if (codes.indexOf(data.code) !== -1) report.calendar.errorCode = data.code;
      }
    });
  });
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
