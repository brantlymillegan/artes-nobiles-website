const video = document.querySelector('.rosarium-video');

if (video) {
  const root = document.documentElement;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let theme;
  let resumeTime = 0;

  video.muted = true;
  video.autoplay = !reducedMotion.matches;

  function syncPlayback() {
    video.autoplay = !reducedMotion.matches;
    if (reducedMotion.matches || document.hidden) video.pause();
    else video.play().catch(() => {
      // If the browser blocks autoplay, leave the still preview visible.
    });
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
  }

  video.addEventListener('loadedmetadata', () => {
    // Both themes have the same timeline; continue at the same point on a switch.
    if (resumeTime > 0) video.currentTime = Math.min(resumeTime, Math.max(0, video.duration - .1));
    syncPlayback();
  });
  const revealFrame = () => {
    if (video.readyState >= 2 && !video.seeking) video.classList.add('is-ready');
  };
  video.addEventListener('loadeddata', revealFrame);
  video.addEventListener('seeked', revealFrame);
  video.addEventListener('playing', revealFrame);
  video.addEventListener('error', () => {
    video.classList.remove('is-ready');
  });
  reducedMotion.addEventListener('change', syncPlayback);
  document.addEventListener('visibilitychange', syncPlayback);
  systemTheme.addEventListener('change', syncTheme);
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  syncTheme();
}
