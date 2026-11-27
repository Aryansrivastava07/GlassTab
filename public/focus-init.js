// Synchronous early focus override for Chrome & Edge New Tab Pages
// Manifest V3 CSP-compliant external script (cannot be inline)
(function () {
  try {
    if (!localStorage.getItem('hasVisited')) return;
    var raw = localStorage.getItem('landing_features_config_v1');
    var autoFocus = true;
    if (raw) {
      var cfg = JSON.parse(raw);
      if (cfg && (cfg.search === false || cfg.autoFocusSearch === false)) {
        autoFocus = false;
      }
    }
    // If autoFocus is enabled and we are not yet on ?focus, force internal reload
    if (autoFocus && !window.location.search.includes('focus')) {
      window.location.search = '?focus';
      throw new Error('Focus override reload');
    }
  } catch (e) {
    if (e && e.message === 'Focus override reload') {
      throw e;
    }
  }
})();
