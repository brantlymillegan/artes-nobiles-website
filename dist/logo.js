import { mountAnimatedLogo } from './assets/logo-motion.js';

const logo = document.querySelector('.company-logo');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (logo) {
  const controllers = [];
  let ready = false;
  let initialPending = true;

  function settle() {
    if (controllers.some(controller => controller.isPlaying)) return;
    logo.classList.remove('is-playing', 'is-initial');
  }

  function play(initial = false) {
    if (!ready || document.hidden || logo.classList.contains('is-playing')) return;
    initialPending = false;
    if (reducedMotion.matches) return;

    logo.classList.toggle('is-initial', initial);
    logo.classList.add('is-playing');
    // Play both variants together so a theme change preserves the animation's progress.
    controllers.forEach(controller => controller.play());
    settle();
  }

  logo.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') play();
  });
  // A native button provides touch, mouse, Enter, and Space activation.
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

    // Keep both static versions visible if either animated asset fails to load.
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
