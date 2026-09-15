const film = document.querySelector('.book-film-video');

if (film) {
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const error = document.querySelector('.film-error');
  const playback = document.querySelector('.film-playback');
  let theme;
  let loaded = false;
  let resumeTime = 0;
  let shouldPlay = !reducedMotion.matches;
  let resumeWhenVisible = false;

  function selectedTheme() {
    return root.dataset.theme === 'dark' || (!root.dataset.theme && system.matches) ? 'dark' : 'light';
  }

  function syncPlaybackControl() {
    playback?.setAttribute('aria-label', film.paused ? 'Play book tour' : 'Pause book tour');
  }

  function play() {
    // If autoplay is blocked, a direct tap can start it without player chrome.
    film.play().catch(syncPlaybackControl);
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
    if (shouldPlay && !document.hidden) play();
  });
  film.addEventListener('play', syncPlaybackControl);
  film.addEventListener('pause', syncPlaybackControl);
  film.addEventListener('error', () => {
    error.hidden = false;
    syncPlaybackControl();
  });
  if (playback) {
    playback.addEventListener('click', () => {
      if (film.paused) {
        // Explicit playback is allowed even when reduced motion disables autoplay.
        shouldPlay = true;
        if (!loaded) {
          loaded = true;
          syncTheme();
        }
        play();
      } else {
        shouldPlay = false;
        resumeWhenVisible = false;
        film.pause();
      }
    });
    syncPlaybackControl();
    playback.hidden = false;
  }
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
    } else if (resumeWhenVisible) {
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
