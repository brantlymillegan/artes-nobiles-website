const video = document.querySelector('.rosarium-video');

if (video) {
  const control = document.querySelector('.rosarium-playback');
  const root = document.documentElement;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let theme;
  let resumeTime = 0;
  let userPaused = reducedMotion.matches;

  video.muted = true;
  video.autoplay = !userPaused;

  function updateControl() {
    const paused = video.paused;
    const label = paused ? 'Play app preview' : 'Pause app preview';
    control.classList.toggle('is-paused', paused);
    control.setAttribute('aria-label', label);
    control.title = label;
  }

  function syncPlayback() {
    if (userPaused || document.hidden) video.pause();
    else video.play().catch(updateControl);
    updateControl();
  }

  function syncTheme() {
    const selected = root.dataset.theme;
    const next = selected === 'dark' || (selected !== 'light' && systemTheme.matches) ? 'dark' : 'light';
    if (next === theme) return;
    if (video.readyState >= 1) resumeTime = video.currentTime;
    theme = next;
    video.pause();
    video.classList.remove('is-ready');
    video.src = video.dataset[`${theme}Src`];
    video.load();
    updateControl();
  }

  video.addEventListener('loadedmetadata', () => {
    control.hidden = false;
    // Both themes have the same timeline; continue at the same point on a switch.
    if (resumeTime > 0) video.currentTime = Math.min(resumeTime, Math.max(0, video.duration - .1));
    syncPlayback();
  });
  const revealFrame = () => {
    if (video.readyState >= 2 && !video.seeking) video.classList.add('is-ready');
  };
  video.addEventListener('loadeddata', revealFrame);
  video.addEventListener('seeked', revealFrame);
  video.addEventListener('playing', () => { revealFrame(); updateControl(); });
  video.addEventListener('pause', updateControl);
  video.addEventListener('error', () => {
    video.classList.remove('is-ready');
    control.hidden = true;
  });
  control.addEventListener('click', () => {
    userPaused = !video.paused;
    video.autoplay = !userPaused;
    syncPlayback();
  });
  reducedMotion.addEventListener('change', () => {
    userPaused = reducedMotion.matches;
    video.autoplay = !userPaused;
    syncPlayback();
  });
  document.addEventListener('visibilitychange', syncPlayback);
  systemTheme.addEventListener('change', syncTheme);
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  control.hidden = false;
  syncTheme();
}
