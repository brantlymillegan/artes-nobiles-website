const video = document.querySelector('.flappy-video');

if (video) {
  const root = document.documentElement;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let theme;
  let nearViewport = false;
  let resumeTime = 0;

  video.muted = true;

  function syncPlayback() {
    const shouldPlay = nearViewport && !reducedMotion.matches && !document.hidden;
    video.autoplay = shouldPlay;
    if (!shouldPlay) video.pause();
    else if (video.readyState >= 2) video.play().catch(() => {
      // Keep the matching still visible if the browser blocks autoplay.
    });
  }

  function syncTheme() {
    const selected = root.dataset.theme;
    const next = selected === 'dark' || (selected !== 'light' && systemTheme.matches) ? 'dark' : 'light';
    if (next === theme) return;
    video.poster = video.dataset[`${next}Poster`];
    if (!nearViewport) return;
    if (video.readyState >= 1) resumeTime = video.currentTime;
    theme = next;
    video.pause();
    video.classList.remove('is-ready');
    video.src = video.dataset[`${theme}Src`];
    video.load();
  }

  video.addEventListener('loadedmetadata', () => {
    // The day and night exports share the same flight and scene changes.
    if (resumeTime > 0) video.currentTime = Math.min(resumeTime, Math.max(0, video.duration - .1));
  });
  function revealFrame() {
    if (video.readyState >= 2 && !video.seeking) video.classList.add('is-ready');
  }
  video.addEventListener('loadeddata', revealFrame);
  video.addEventListener('seeked', revealFrame);
  video.addEventListener('playing', revealFrame);
  video.addEventListener('canplay', syncPlayback);
  video.addEventListener('error', () => video.classList.remove('is-ready'));
  reducedMotion.addEventListener('change', syncPlayback);
  document.addEventListener('visibilitychange', syncPlayback);
  systemTheme.addEventListener('change', syncTheme);
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  syncPlayback();
  syncTheme();

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      nearViewport = entries.some(entry => entry.isIntersecting);
      syncTheme();
      syncPlayback();
    }, { rootMargin: '120px' });
    observer.observe(video);
  } else {
    nearViewport = true;
    syncTheme();
    syncPlayback();
  }
}
