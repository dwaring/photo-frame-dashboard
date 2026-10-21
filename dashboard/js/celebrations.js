// Local SVG artwork; rewards never change chore data or contact a service.
(function () {
  'use strict';
  var kinds = ['narwhal', 'rocket', 'dinosaur', 'star'], bag = [], last, queue = [], active = false;
  var memory = {}, storageKey = 'home-hq-chore-celebrations-v1';
  var art = {
    narwhal: '<path d="M60 105Q15 45 12 100Q-5 145 60 125" fill="#78cddd"/><ellipse cx="120" cy="105" rx="75" ry="46" fill="#9ce5eb"/><path d="M165 75L235 32 188 91" fill="#ffe6a8"/><path d="M100 125Q115 170 143 131" fill="#58bccf"/><circle cx="160" cy="99" r="5" fill="#24344a"/><path d="M160 117q13 10 23-4" fill="none" stroke="#24344a" stroke-width="4"/><circle cx="151" cy="114" r="7" fill="#f7a8c3"/>',
    rocket: '<path class="celebration-flame" d="M91 146Q120 230 149 146" fill="#ffba55"/><path d="M91 129L60 164 63 110 91 85M149 129L180 164 177 110 149 85" fill="#ef7e9a"/><path d="M90 144Q65 60 120 13Q175 60 150 144Z" fill="#f4f0e6"/><path d="M97 39Q120 0 143 39" fill="#ef7e9a"/><circle cx="120" cy="83" r="24" fill="#71ccdf" stroke="#415d80" stroke-width="7"/>',
    dinosaur: '<path d="M70 112L42 79 48 115 15 104Q22 155 95 150L104 178 122 178 119 145 145 145 153 178 172 178 165 133Q207 119 206 77Q207 47 180 46Q150 43 148 77L145 100Q100 84 70 112Z" fill="#8cd1a0"/><path d="M76 106L85 83 104 100 118 78 133 101" fill="#49a879"/><path d="M161 48L175 8 195 48" fill="#f393b5"/><circle cx="175" cy="8" r="7" fill="#ffd979"/><circle cx="186" cy="67" r="4" fill="#24344a"/><path d="M184 87q12 8 21-3" fill="none" stroke="#24344a" stroke-width="4"/>',
    star: '<path d="M120 20L146 77 210 83 162 126 175 190 120 158 65 190 78 126 30 83 94 77Z" fill="#ffda72" stroke="#f3b455" stroke-width="5" stroke-linejoin="round"/><circle cx="102" cy="107" r="5" fill="#604c48"/><circle cx="138" cy="107" r="5" fill="#604c48"/><path d="M105 128q15 17 30 0" fill="none" stroke="#604c48" stroke-width="5" stroke-linecap="round"/>'
  };
  function next() {
    if (!bag.length) {
      bag = kinds.slice();
      for (var i = bag.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
      if (bag[bag.length - 1] === last) { var swap = bag[0]; bag[0] = bag[bag.length - 1]; bag[bag.length - 1] = swap; }
    }
    last = bag.pop(); return last;
  }
  function play() {
    if (active || !queue.length) return;
    active = true;
    var item = queue.shift(), kind = next(), el = document.createElement('div');
    el.className = 'celebration celebration--' + kind;
    var sparks = Array.from({ length: 16 }, function (_, i) {
      return '<i style="--angle:' + (i * 22.5) + 'deg;--distance:' + (120 + i % 4 * 28) + 'px;--spark:' + ['#f28caf', '#78cddd', '#ffd979', '#99d5a7'][i % 4] + '"></i>';
    }).join('');
    el.innerHTML = '<div class="celebration-flight" aria-hidden="true"><div class="celebration-trail"></div><svg viewBox="0 0 240 220">' + art[kind] + '</svg></div><div class="celebration-sparks" aria-hidden="true">' + sparks + '</div><div class="celebration-message" role="status" aria-live="polite"><small></small><b></b><span></span></div>';
    el.querySelector('small').textContent = item.preview ? 'Preview · ' + kind : 'Way to go!';
    el.querySelector('b').textContent = item.name + '!';
    el.querySelector('.celebration-message span').textContent = item.routine + ' complete!';
    document.getElementById('stage').appendChild(el);
    setTimeout(function () { el.remove(); active = false; play(); }, 2900);
  }
  window.Celebrations = {
    preview: function () { if (queue.length < 4) { queue.push({ name: 'Superstar', routine: 'Morning', preview: true }); play(); } },
    reward: function (date, person, slot, name, routine) {
      var key = date + ':' + person + ':' + slot, saved = {};
      try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch (e) {}
      if (memory[key] || saved[key]) return false;
      memory[key] = true;
      // Only today's keys are needed. Storage denial still permits session deduplication.
      saved = Object.fromEntries(Object.entries(saved).filter(function (entry) { return entry[0].startsWith(date + ':'); }));
      saved[key] = true;
      try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch (e) {}
      queue.push({ name: name, routine: routine }); play(); return true;
    }
  };
})();
