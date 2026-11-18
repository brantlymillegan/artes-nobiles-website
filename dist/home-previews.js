// Each preview fetches metadata as it approaches the screen and plays only on screen.
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const compact = matchMedia('(max-width: 839px)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const previews = new Map();

for (const video of document.querySelectorAll('video[data-light-small-src]')) {
  const error = video.closest('.product-visual').querySelector('.film-error');
  let source = null;
  let position = 0;
  const state = { near: false, visible: false, update };
  previews.set(video, state);

  function rememberPosition() {
    if (source && video.readyState >= HTMLMediaElement.HAVE_METADATA) position = video.currentTime;
  }

  function update() {
    const theme = document.documentElement.dataset.theme ?? (systemDark.matches ? 'dark' : 'light');
    const next = video.dataset[theme + (compact.matches ? 'SmallSrc' : 'Src')];
    if ((!state.near && !state.visible) || reduceMotion.matches) {
      if (source) {
        rememberPosition();
        source = null;
        video.pause();
        video.classList.remove('is-ready');
        video.removeAttribute('src');
        video.load(); // Stop buffering and release the offscreen decoder.
      }
      if (error) error.hidden = true;
      return;
    }
    if (document.hidden) {
      video.pause();
      return;
    }
    if (source !== next) {
      rememberPosition();
      video.pause();
      video.classList.remove('is-ready');
      if (error) error.hidden = true;
      source = next;
      video.preload = 'metadata';
      video.src = source;
      video.load();
    }
    if (state.visible) {
      if (video.paused && !video.error) video.play().catch(() => {
        // A browser with autoplay disabled keeps showing the still.
      });
    } else {
      video.pause();
    }
  }

  video.addEventListener('loadedmetadata', () => {
    if (source && position > 0) video.currentTime = Math.min(position, Math.max(0, video.duration - .1));
  });
  video.addEventListener('playing', () => {
    if (state.visible && source && !reduceMotion.matches && !document.hidden) video.classList.add('is-ready');
  });
  video.addEventListener('error', () => {
    video.classList.remove('is-ready');
    if (error && source && video.error) error.hidden = false;
  });
}

function updateAll() {
  for (const state of previews.values()) state.update();
}
for (const preference of [systemDark, compact, reduceMotion]) preference.addEventListener('change', updateAll);
new MutationObserver(updateAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
document.addEventListener('visibilitychange', updateAll);
window.addEventListener('pageshow', updateAll);

if ('IntersectionObserver' in window) {
  for (const [property, margin] of [['near', 160], ['visible', 0]]) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const state = previews.get(entry.target);
        state[property] = entry.isIntersecting && entry.intersectionRect.height > 0 && entry.intersectionRect.width > 0;
        state.update();
      }
    }, { rootMargin: margin + 'px 0px', threshold: [0, .001] });
    for (const video of previews.keys()) observer.observe(video);
  }
} else {
  function updateBounds() {
    for (const [video, state] of previews) {
      const rect = video.getBoundingClientRect();
      state.visible = rect.bottom > 0 && rect.top < innerHeight;
      state.near = rect.bottom > -160 && rect.top < innerHeight + 160;
      state.update();
    }
  }
  window.addEventListener('scroll', updateBounds, { passive: true });
  window.addEventListener('resize', updateBounds);
  updateBounds();
}
