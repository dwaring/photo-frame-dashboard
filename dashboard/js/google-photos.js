// Shared private photo source for home, Photos and ambient slideshows.
(function () {
  App.photoSourceLabel = 'No photos imported';
  async function load() {
    try {
      var response = await fetch('/api/google-photos/list', { cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      var data = await response.json();
      if (!Array.isArray(data.photos)) throw new Error('Invalid photo list');
      if (App.photoImportVersion === JSON.stringify(data)) return;
      App.photoImportVersion = JSON.stringify(data);
      window.DATA.photos = data.photos;
      App.photoSourceLabel = 'Google Photos';
      App.emit('photos-updated');
      App.rerender();
    } catch (_) {
      if (App.photoImportVersion) App.photoSourceLabel = 'Google Photos · refresh unavailable';
    }
  }
  load();
  window.addEventListener('focus', load);
  setInterval(load, 60000);
})();
