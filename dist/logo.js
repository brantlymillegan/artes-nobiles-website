import { mountAnimatedLogo } from './assets/logo-motion.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const heroLogo = document.querySelector('.site-header .company-logo');
const navigation = document.querySelector('.product-navigation');
const compactLogo = navigation?.querySelector('.nav-logo');
const sentinel = document.querySelector('.nav-sentinel');

function initializeLogo(logo, onLoad) {
  const controllers = [];
  let ready = false;
  let initialPending = onLoad;

  function settle() {
    if (controllers.some(controller => controller.isPlaying)) return;
    logo.classList.remove('is-playing', 'is-initial');
  }

  function play(initial = false, restart = false) {
    if (!ready || document.hidden || reducedMotion.matches) return;
    if (logo.classList.contains('is-playing') && !restart) return;
    initialPending = false;
    if (restart) controllers.forEach(controller => controller.stop());
    logo.classList.toggle('is-initial', initial);
    logo.classList.add('is-playing');
    // Both themes and all logo instances use the original, independently scoped SVGs.
    controllers.forEach(controller => controller.play());
    settle();
  }

  logo.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') play();
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
  return { play };
}

const logos = new Map([...document.querySelectorAll('.company-logo')].map(logo => [
  logo, initializeLogo(logo, logo === heroLogo),
]));

if (navigation && compactLogo && sentinel) {
  function updateStickyState() {
    const stuck = sentinel.getBoundingClientRect().top < 0;
    navigation.classList.toggle('is-stuck', stuck);
    compactLogo.setAttribute('aria-hidden', String(!stuck));
    compactLogo.tabIndex = stuck ? 0 : -1;
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

  compactLogo.addEventListener('click', event => {
    // Preserve normal open-in-new-tab and modified link clicks.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    heroLogo?.focus({ preventScroll: true });
    // Replay the full-size logo where it will remain visible after the immediate jump.
    logos.get(heroLogo)?.play(false, true);
    if (window.location.hash !== '#top') window.history.pushState(null, '', '#top');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    updateStickyState();
  });
}
