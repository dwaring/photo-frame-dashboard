// Shared source for home, Photos and ambient slideshows. Keep demos explicit.
(function () {
  App.photoSourceLabel = 'Demo photos';
  async function load() {
    try {
      var response = await fetch('/api/google-photos/list', { cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      var data = await response.json();
      if (!data.photos || !data.photos.length) return;
      if (App.photoImportVersion === data.importedAt) return;
      App.photoImportVersion = data.importedAt;
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
