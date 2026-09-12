/** One-shot hover / focus / page-load control for the supplied SVGs. */
export const LOGO_DURATION = 2000;
let logoInstance = 0;
function scopeSvgIds(svg) {
  if (svg.dataset.idsScoped) return;
  const prefix = `an-grow-${++logoInstance}-`;
  const ids = new Map();
  svg.querySelectorAll('[id]').forEach(node => {
    const old = node.id;
    ids.set(old, prefix + old);
    node.dataset.logoId = old;
    node.id = prefix + old;
  });
  svg.querySelectorAll('*').forEach(node => {
    for (const attr of [...node.attributes]) {
      let value = attr.value.replace(/url\(#([^)]*)\)/g, (match, id) => ids.has(id) ? `url(#${ids.get(id)})` : match);
      if ((attr.name === 'href' || attr.name === 'xlink:href') && value.startsWith('#') && ids.has(value.slice(1))) value = '#' + ids.get(value.slice(1));
      if (value !== attr.value) node.setAttribute(attr.name, value);
    }
  });
  svg.dataset.idsScoped = 'true';
}
const attached = new WeakMap();
const mounted = new WeakMap();
const mountRequests = new WeakMap();

export function attachLogoMotion(svg, { onHover = true, onLoad = true, trigger = svg } = {}) {
  if (attached.has(svg)) return attached.get(svg);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let playing = false;
  let timer = 0;
  let firstFrame = 0;
  let secondFrame = 0;
  let destroyed = false;
  svg.classList.remove('is-playing');
  scopeSvgIds(svg);
  svg.pauseAnimations();
  svg.setCurrentTime(0);

  const stop = () => {
    cancelAnimationFrame(firstFrame);
    cancelAnimationFrame(secondFrame);
    clearTimeout(timer);
    playing = false;
    svg.pauseAnimations();
    svg.setCurrentTime(0);
    svg.classList.remove('is-playing');
    svg.dispatchEvent(new CustomEvent('logo-motion-end'));
  };
  const play = () => {
    if (destroyed || playing || reduceMotion.matches || document.hidden) return false;
    svg.classList.remove('is-playing');
    void svg.getBoundingClientRect();
    svg.setCurrentTime(0);
    svg.unpauseAnimations();
    playing = true;
    svg.classList.add('is-playing');
    svg.dispatchEvent(new CustomEvent('logo-motion-start'));
    timer = window.setTimeout(stop, LOGO_DURATION);
    return true;
  };
  const onPreference = () => { if (reduceMotion.matches) stop(); };
  const onVisibility = () => { if (document.hidden && playing) stop(); };
  if (onHover) {
    trigger.addEventListener('pointerenter', play);
    trigger.addEventListener('focusin', play);
  }
  reduceMotion.addEventListener('change', onPreference);
  document.addEventListener('visibilitychange', onVisibility);
  const controller = {
    play,
    stop,
    get isPlaying() { return playing; },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      stop();
      trigger.removeEventListener('pointerenter', play);
      trigger.removeEventListener('focusin', play);
      reduceMotion.removeEventListener('change', onPreference);
      document.removeEventListener('visibilitychange', onVisibility);
      attached.delete(svg);
    },
  };
  attached.set(svg, controller);
  if (onLoad) {
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(play);
    });
  }
  return controller;
}

export async function mountAnimatedLogo(container, src, options = {}) {
  const request = {};
  mountRequests.set(container, request);
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Logo could not be loaded (${response.status}).`);
  const documentSvg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
  if (documentSvg.querySelector('parsererror') || documentSvg.documentElement.localName !== 'svg') {
    throw new Error('The logo file is not a valid SVG.');
  }
  if (mountRequests.get(container) !== request) {
    throw new DOMException('A newer logo mount replaced this request.', 'AbortError');
  }
  const svg = document.importNode(documentSvg.documentElement, true);
  svg.classList.remove('is-playing');
  svg.setAttribute('aria-label', 'Artes Nobiles');
  svg.removeAttribute('aria-labelledby');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.display = 'block';
  svg.style.width = '100%';
  svg.style.height = 'auto';
  mounted.get(container)?.destroy();
  container.replaceChildren(svg);
  const controller = attachLogoMotion(svg, { trigger: container, ...options });
  controller.svg = svg;
  mounted.set(container, controller);
  return controller;
}
