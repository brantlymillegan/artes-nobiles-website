import { mountAnimatedLogo } from './assets/logo-motion.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const heroLogo = document.querySelector('.site-header .company-logo');
const pageTop = document.querySelector('#top');
const navigation = document.querySelector('.product-navigation');
const compactLogo = navigation?.querySelector('.nav-logo');
const sentinel = document.querySelector('.nav-sentinel');
let suppressHeroHover = false;

function initializeLogo(logo, onLoad) {
  const controllers = [];
  let ready = false;
  let initialPending = onLoad;

  function settle() {
    if (controllers.some(controller => controller.isPlaying)) return;
    logo.classList.remove('is-playing', 'is-initial');
  }

  function play(initial = false) {
    if (!ready || document.hidden || reducedMotion.matches) return;
    if (logo.classList.contains('is-playing')) return;
    initialPending = false;
    logo.classList.toggle('is-initial', initial);
    logo.classList.add('is-playing');
    // Both themes and all logo instances use the original, independently scoped SVGs.
    controllers.forEach(controller => controller.play());
    settle();
  }

  logo.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' && !(logo === heroLogo && suppressHeroHover)) play();
  });
  logo.addEventListener('pointermove', event => {
    // Scrolling can move the logo beneath a stationary pointer. Only deliberate
    // movement over it should restore hover playback after returning to the top.
    if (logo === heroLogo && suppressHeroHover && event.pointerType === 'mouse' && (event.movementX || event.movementY)) {
      suppressHeroHover = false;
      play();
    }
  });
  logo.addEventListener('click', () => play());
  logo.addEventListener('focusin', () => {
    if (logo.matches(':focus-visible')) play();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && initialPending) play(true);
  });

  async function initialize() {
    const layers = [...logo.querySelectorAll('.company-logo-motion')];
    const results = await Promise.allSettled(layers.map(layer => mountAnimatedLogo(
      layer,
      layer.dataset.logoSrc,
      { onLoad: false, onHover: false },
    )));

    // Keep the static logos if either animation asset is unavailable.
    if (results.some(result => result.status === 'rejected')) {
      results.forEach(result => {
        if (result.status === 'fulfilled') result.value.destroy();
      });
      return;
    }

    results.forEach(result => {
      const controller = result.value;
      controllers.push(controller);
      controller.svg.setAttribute('aria-hidden', 'true');
      controller.svg.setAttribute('focusable', 'false');
      controller.svg.addEventListener('logo-motion-end', settle);
    });
    ready = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (initialPending) play(true);
    }));
  }

  initialize();
}

document.querySelectorAll('.company-logo').forEach(logo => {
  initializeLogo(logo, logo === heroLogo);
});

if (navigation && compactLogo && sentinel) {
  function updateStickyState() {
    const stuck = sentinel.getBoundingClientRect().top < 0;
    navigation.classList.toggle('is-stuck', stuck);
    const visible = stuck || (navigation.querySelector('.mobile-menu-toggle') && window.matchMedia('(max-width: 839px)').matches);
    compactLogo.setAttribute('aria-hidden', String(!visible));
    compactLogo.tabIndex = visible ? 0 : -1;
  }

  function updateNavigationHeight() {
    document.documentElement.style.setProperty('--navigation-height', `${navigation.offsetHeight}px`);
    updateStickyState();
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(updateStickyState, { threshold: [0, 1] });
    observer.observe(sentinel);
  } else {
    window.addEventListener('scroll', updateStickyState, { passive: true });
  }
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(updateNavigationHeight);
    observer.observe(navigation);
  }
  window.addEventListener('resize', updateNavigationHeight, { passive: true });
  window.addEventListener('pageshow', updateNavigationHeight);
  window.addEventListener('hashchange', updateStickyState);
  updateNavigationHeight();

  let scrollFrame = 0;
  function cancelReturnScroll() {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
  }

  function scrollQuicklyToTop() {
    cancelReturnScroll();
    const startY = window.scrollY;
    const startTime = performance.now();
    const duration = 360;

    function step(now) {
      const progress = reducedMotion.matches ? 1 : Math.min(1, (now - startTime) / duration);
      const remaining = (1 - progress) ** 3;
      // Each step is immediate so the page's normal smooth-anchor CSS cannot interfere.
      window.scrollTo({ top: startY * remaining, left: 0, behavior: 'instant' });
      updateStickyState();
      scrollFrame = progress < 1 ? requestAnimationFrame(step) : 0;
    }
    if (reducedMotion.matches) step(startTime + duration);
    else scrollFrame = requestAnimationFrame(step);
  }

  // Let deliberate user scrolling interrupt the return animation.
  window.addEventListener('wheel', cancelReturnScroll, { passive: true });
  window.addEventListener('touchstart', cancelReturnScroll, { passive: true });
  window.addEventListener('pagehide', cancelReturnScroll);
  window.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cancelReturnScroll();
  });

  compactLogo.addEventListener('click', event => {
    // Preserve normal open-in-new-tab and modified link clicks.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    suppressHeroHover = true;
    // Keep focus at the destination without triggering the large logo's focus animation.
    pageTop?.focus({ preventScroll: true });
    if (window.location.hash !== '#top') window.history.pushState(null, '', '#top');
    scrollQuicklyToTop();
  });
}
