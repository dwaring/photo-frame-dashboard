// Safari 12 supports Grid gaps but not Flex gaps. Test layout, not CSS.supports('gap').
document.addEventListener('DOMContentLoaded', function () {
  var probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px;';
  for (var i = 0; i < 2; i++) {
    var item = document.createElement('div');
    item.style.cssText = 'height:1px;flex:none;';
    probe.appendChild(item);
  }
  document.body.appendChild(probe);
  var supported = probe.scrollHeight === 3;
  probe.remove();
  if (supported) return;

  var stage = document.getElementById('stage');
  if (!stage) return;
  var pending = new Set(), previous = new WeakMap(), frame = null;
  function collect(node) {
    if (!node || node.nodeType !== 1) return;
    pending.add(node);
    Array.prototype.forEach.call(node.querySelectorAll('*'), function (child) { pending.add(child); });
  }
  function flush() {
    frame = null;
    var nodes = Array.from(pending), writes = [];
    pending.clear();
    // Remove only this shim's previous margins, retaining original inline values.
    nodes.forEach(function (node) {
      var entries = previous.get(node) || [];
      entries.forEach(function (entry) {
        if (entry.child.style[entry.property] === entry.applied) entry.child.style[entry.property] = entry.original;
      });
      previous.delete(node);
    });
    nodes.forEach(function (node) {
      if (!stage.contains(node)) return;
      var style = getComputedStyle(node);
      if (style.display !== 'flex' && style.display !== 'inline-flex') return;
      var column = style.flexDirection.indexOf('column') === 0;
      var reverse = style.flexDirection.indexOf('reverse') !== -1;
      var gap = parseFloat(column ? style.rowGap : style.columnGap) || 0;
      if (!gap) return;
      var property = column ? (reverse ? 'marginBottom' : 'marginTop') : (reverse ? 'marginRight' : 'marginLeft');
      var children = Array.prototype.filter.call(node.children, function (child) {
        var childStyle = getComputedStyle(child);
        return childStyle.display !== 'none' && childStyle.position !== 'absolute' && childStyle.position !== 'fixed';
      });
      children.slice(1).forEach(function (child) {
        var margin = getComputedStyle(child)[property];
        // Auto margins already provide separation and must keep their layout role.
        if (margin === 'auto') return;
        writes.push({ parent: node, child: child, property: property, original: child.style[property], applied: ((parseFloat(margin) || 0) + gap) + 'px' });
      });
    });
    writes.forEach(function (entry) {
      entry.child.style[entry.property] = entry.applied;
      var entries = previous.get(entry.parent) || [];
      entries.push(entry); previous.set(entry.parent, entries);
    });
  }
  function schedule() { if (frame === null) frame = requestAnimationFrame(flush); }
  new MutationObserver(function (records) {
    records.forEach(function (record) {
      collect(record.target);
      // A child's class can affect whether it occupies space in its parent's flex row.
      if (record.type === 'attributes') collect(record.target.parentElement);
    });
    schedule();
  }).observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', function () { collect(stage); schedule(); });
  collect(stage); schedule();
});
