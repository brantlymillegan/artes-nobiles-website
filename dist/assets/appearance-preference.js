/* Shared by the publisher homepage and game. The storefront uses the same
   first-party cookie so its appearance is available before the first paint. */
(() => {
  const key = 'artes-nobiles-theme';
  const shared = location.protocol === 'https:' && /(^|\.)artesnobiles\.com$/.test(location.hostname);
  function saveCookie(value) {
    if (!shared) return;
    try { document.cookie = `${key}=${value}; Domain=artesnobiles.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure`; } catch {}
  }
  function read() {
    if (shared) {
      try {
        const saved = document.cookie.match(/(?:^|;\s*)artes-nobiles-theme=(system|dark|light)(?:;|$)/);
        if (saved) return saved[1];
      } catch {}
    }
    try {
      const previous = localStorage.getItem(key);
      if (previous === 'dark' || previous === 'light') {
        saveCookie(previous);
        return previous;
      }
    } catch {}
    return 'system';
  }
  function write(value) {
    if (!['system', 'light', 'dark'].includes(value)) return;
    saveCookie(value);
    try {
      if (value === 'system') localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {}
  }
  window.anAppearancePreference = { read, write };
})();
