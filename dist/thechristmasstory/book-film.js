const film = document.querySelector('.book-film-video');

if (film) {
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const error = document.querySelector('.film-error');
  let theme;
  let loaded = false;
  let resumeTime = 0;
  let shouldPlay = !reducedMotion.matches;
  let resumeWhenVisible = false;

  function selectedTheme() {
    return root.dataset.theme === 'dark' || (!root.dataset.theme && system.matches) ? 'dark' : 'light';
  }

  function play() {
    film.play().catch(() => {}); // Native controls remain usable if autoplay is blocked.
  }

  function syncTheme() {
    const next = selectedTheme();
    film.poster = film.dataset[`${next}Poster`];
    if (!loaded || theme === next) return;
    if (theme) {
      if (film.readyState >= 1) resumeTime = film.currentTime;
      // Preserve a deliberate pause and the playback position on a theme change.
      shouldPlay = document.hidden ? resumeWhenVisible : !film.paused;
    }
    theme = next;
    film.pause();
    error.hidden = true;
    film.src = film.dataset[`${theme}Src`];
    film.load();
  }

  film.addEventListener('loadedmetadata', () => {
    if (resumeTime > 0) film.currentTime = Math.min(resumeTime, Math.max(0, film.duration - .1));
    if (shouldPlay && !document.hidden && !reducedMotion.matches) play();
  });
  film.addEventListener('error', () => { error.hidden = false; });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      shouldPlay = false;
      resumeWhenVisible = false;
      film.pause();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      resumeWhenVisible = !film.paused;
      film.pause();
    } else if (resumeWhenVisible && !reducedMotion.matches) {
      resumeWhenVisible = false;
      play();
    }
  });
  system.addEventListener('change', syncTheme);
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  syncTheme();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        loaded = true;
        syncTheme();
        observer.disconnect();
      }
    }, { rootMargin: '120px' });
    observer.observe(film);
  } else {
    loaded = true;
    syncTheme();
  }
}
