// Household quiet hours use Adelaide time, independently of the device timezone.
export function isQuietTime(date) {
  var parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Australia/Adelaide', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  var hour = Number(parts.filter(function (p) { return p.type === 'hour'; })[0].value) % 24;
  var minute = Number(parts.filter(function (p) { return p.type === 'minute'; })[0].value);
  var minutes = hour * 60 + minute;
  return minutes >= 22 * 60 + 30 || minutes < 6 * 60;
}
function update() {
  var stage = document.getElementById('stage');
  if (stage) stage.classList.toggle('is-quiet-hours', isQuietTime(new Date()));
}
if (typeof document !== 'undefined') {
  update();
  document.addEventListener('DOMContentLoaded', update);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('focus', update);
  setInterval(update, 15000);
}
