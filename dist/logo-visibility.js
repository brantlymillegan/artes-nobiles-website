const pending = new Map();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let frame = 0;
let watching = false;

function schedule() {
  if (pending.size && !frame) frame = requestAnimationFrame(checkPending);
}

const intersections = 'IntersectionObserver' in window
  ? new IntersectionObserver(schedule, { threshold: [0, .5, 1] })
  : null;
const mutations = new MutationObserver(schedule);

function appearance(element) {
  const rect = element.getBoundingClientRect();
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(document.documentElement.clientWidth, rect.right);
  const bottom = Math.min(innerHeight, rect.bottom);
  if (rect.width <= 0 || rect.height <= 0 || right <= left || bottom <= top ||
      (right - left) * (bottom - top) < rect.width * rect.height * .5 || element.closest('[inert]')) {
    return { visible: false, transitioning: false };
  }

  let opacity = 1;
  let visible = true;
  let transitioning = false;
  for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (style.visibility !== 'visible' || style.display === 'none') visible = false;
    opacity *= Number(style.opacity);
    // Menu items and the compact seal fade in after a delay. Keep checking while
    // those transitions run, even if their intersection rectangle stays put.
    transitioning ||= ancestor.getAnimations().some(animation =>
      'transitionProperty' in animation && (animation.playState === 'running' || animation.pending));
  }

  // Also exclude icons covered by the sticky bar or a still-unfolding menu.
  const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
  visible &&= opacity >= .5 && !!hit &&
    (element.contains(hit) || hit === element.closest('a, button'));
  return { visible, transitioning };
}

function checkPending() {
  frame = 0;
  if (document.hidden || reducedMotion.matches) return;
  let transitioning = false;
  for (const [element, play] of pending) {
    const state = appearance(element);
    if (state.visible && play()) {
      pending.delete(element);
      intersections?.unobserve(element);
    } else {
      transitioning ||= state.transitioning;
    }
  }
  if (!pending.size) stopWatching();
  else if (transitioning) schedule();
}

function stopWatching() {
  if (pending.size || !watching) return;
  watching = false;
  cancelAnimationFrame(frame);
  frame = 0;
  intersections?.disconnect();
  mutations.disconnect();
  document.removeEventListener('scroll', schedule, true);
  document.removeEventListener('visibilitychange', schedule);
  window.removeEventListener('resize', schedule);
  window.removeEventListener('pageshow', schedule);
  reducedMotion.removeEventListener('change', schedule);
}

export function onFirstAppearance(element, play) {
  pending.set(element, play);
  intersections?.observe(element);
  if (!watching) {
    watching = true;
    mutations.observe(document.documentElement, {
      subtree: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'inert', 'aria-expanded'],
    });
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('pageshow', schedule);
    reducedMotion.addEventListener('change', schedule);
  }
  schedule();
  return {
    check: schedule,
    cancel() {
      pending.delete(element);
      intersections?.unobserve(element);
      stopWatching();
    },
  };
}
