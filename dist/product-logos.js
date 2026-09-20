const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sources = new Map();
const stopAnimations = [];

function loadSource(url) {
  if (!sources.has(url)) {
    sources.set(url, fetch(url).then(async response => {
      if (!response.ok) throw new Error(`Logo unavailable: ${response.status}`);
      const document = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
      if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') {
        throw new Error('Invalid logo SVG');
      }
      return document.documentElement;
    }));
  }
  return sources.get(url);
}

for (const icon of document.querySelectorAll('[data-product-logo]')) {
  const triggers = new Set([icon.closest('a') || icon]);
  const heading = document.getElementById(icon.dataset.logoHover);
  if (heading) triggers.add(heading);
  let layer;
  let playing = false;
  let requested = false;
  let finishTimer;
  let resetTimer;

  function stop(immediate = false) {
    requested = false;
    playing = false;
    clearTimeout(finishTimer);
    clearTimeout(resetTimer);
    icon.classList.remove('is-logo-playing');
    if (immediate) layer?.removeAttribute('data-playing');
    else resetTimer = setTimeout(() => layer?.removeAttribute('data-playing'), 140);
  }
  stopAnimations.push(() => stop(true));

  function play() {
    if (reducedMotion.matches || document.hidden || playing) return;
    if (!layer) { requested = true; return; }
    clearTimeout(resetTimer);
    // Removing the state discards the prior CSS timeline, so every replay starts fresh.
    layer.removeAttribute('data-playing');
    layer.getBoundingClientRect();
    layer.setAttribute('data-playing', '');
    icon.classList.add('is-logo-playing');
    requested = false;
    playing = true;
    // All supplied loops visibly settle before four seconds, including delayed sparkles.
    finishTimer = setTimeout(() => stop(), 4000);
  }

  for (const trigger of triggers) {
    trigger.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') play();
    });
    trigger.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse') play();
    });
    trigger.addEventListener('focusin', () => {
      if (trigger.matches(':focus-visible')) play();
    });
  }

  loadSource(icon.dataset.logoSrc).then(source => {
    const host = document.createElement('span');
    host.className = 'product-logo-motion';
    host.setAttribute('aria-hidden', 'true');
    // Each copy keeps its own SVG IDs, masks, keyframes and styles inside a shadow root.
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { pointer-events: none; }
      svg { display: block; width: 100%; height: 100%; max-width: none; overflow: visible; }
      :host(:not([data-playing])) svg * { animation: none !important; }
    `;
    const svg = document.importNode(source, true);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    shadow.append(style, svg);
    icon.append(host);
    layer = host;
    if (requested && [...triggers].some(trigger => trigger.matches(':hover, :focus-visible'))) play();
  }).catch(() => {
    // The original static image remains visible if an animation cannot load.
    requested = false;
  });
}

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) stopAnimations.forEach(stop => stop());
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAnimations.forEach(stop => stop());
});
