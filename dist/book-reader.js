const reader = document.querySelector('.book-reader');

if (reader) {
  const trigger = reader.querySelector('.reader-cover');
  const host = reader.querySelector('.reader-flip');
  const stage = reader.querySelector('.reader-stage');
  const hint = reader.querySelector('.reader-hint');
  const toolbar = reader.querySelector('.reader-toolbar');
  const previous = reader.querySelector('.reader-previous');
  const next = reader.querySelector('.reader-next');
  const closeButton = reader.querySelector('.reader-close');
  const position = reader.querySelector('.reader-position');
  const error = reader.querySelector('.reader-error');
  const transcript = reader.querySelector('.reader-transcript');
  const product = reader.closest('.christmas-product');
  const layout = product.querySelector('.christmas-layout');
  const desktop = matchMedia('(min-width: 960px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const assetRoot = new URL('./assets/book/137/', import.meta.url);
  let manifest, flip, initialized, operation = Promise.resolve();
  let generation = 0;
  let state = 'closed';
  let turning = false;
  let readerWidth = 0;
  let flipWaiter = null;
  let layoutMotion = null;
  const pageImages = [], pageLoads = new Map();

  function finishLayoutMotion(preserveHeight = false) {
    const current = layoutMotion;
    layoutMotion = null;
    if (current) {
      current.animations.forEach(animation => animation.cancel());
      current.image.remove();
      trigger.style.removeProperty('visibility');
    }
    if (preserveHeight !== true) product.style.removeProperty('height');
  }

  function holdProductHeight() {
    if (desktop.matches && !reducedMotion.matches && trigger.animate) {
      product.style.height = `${product.getBoundingClientRect().height}px`;
    }
  }

  async function relocateBook(expanded) {
    const first = layoutMotion?.image.getBoundingClientRect() || trigger.getBoundingClientRect();
    const firstHeight = product.getBoundingClientRect().height;
    const copy = [...layout.querySelectorAll(':scope > .product-category, :scope > .product-details')];
    const copyBefore = copy.map(element => element.getBoundingClientRect());
    finishLayoutMotion(true);
    if (desktop.matches && !reducedMotion.matches && trigger.animate) product.style.height = `${firstHeight}px`;
    product.dataset.readerExpanded = String(expanded);
    // Commit the final width once. The page engine never resizes frame by frame.
    syncLayout(true);
    if (!desktop.matches || reducedMotion.matches || !trigger.animate) {
      product.style.removeProperty('height');
      return;
    }
    // The inner grid takes its natural destination size while the outer article
    // holds the page in place. Shrink the article over the same 480 ms as the
    // cover return, rather than letting the browser clamp the scroll at once.
    product.style.height = `${firstHeight}px`;
    const productStyle = getComputedStyle(product);
    const inset = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
      .reduce((total, property) => total + (parseFloat(productStyle[property]) || 0), 0);
    const lastHeight = layout.getBoundingClientRect().height + inset;
    const last = trigger.getBoundingClientRect();
    const image = trigger.querySelector('img').cloneNode();
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    Object.assign(image.style, {
      position: 'fixed', left: `${last.left}px`, top: `${last.top}px`,
      width: `${last.width}px`, height: `${last.height}px`, maxWidth: 'none',
      zIndex: '14', pointerEvents: 'none', transformOrigin: '0 0',
      boxShadow: '0 2px 3px #14221816, 0 15px 25px -14px #14221840',
    });
    // A fixed cover can cross between the two layouts without escaping the
    // reader's overflow containment or changing the document's scroll bounds.
    document.body.append(image);
    trigger.style.visibility = 'hidden';
    const timing = { duration: 480, easing: 'cubic-bezier(.2,.7,.2,1)' };
    const animations = [image.animate([
      { transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width}, ${first.height / last.height})` },
      { transform: 'none' },
    ], timing)];
    copy.forEach((element, index) => {
      const before = copyBefore[index], after = element.getBoundingClientRect();
      animations.push(element.animate([
        { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})`, transformOrigin: '0 0' },
        { transform: 'none', transformOrigin: '0 0' },
      ], timing));
    });
    animations.push(product.animate([
      { height: `${firstHeight}px` }, { height: `${lastHeight}px` },
    ], { ...timing, fill: 'forwards' }));
    const current = layoutMotion = { image, animations, top: last.top, scrollY: window.scrollY };
    await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
    if (layoutMotion === current) finishLayoutMotion();
  }

  function setState(value) {
    state = value;
    reader.dataset.state = value;
    trigger.setAttribute('aria-expanded', String(value !== 'closed'));
    trigger.disabled = value !== 'closed';
    reader.setAttribute('aria-busy', String(value === 'opening' || value === 'closing' || turning));
    toolbar.hidden = value === 'closed' || value === 'opening';
    updateControls();
  }

  function visibleIndices(index = flip?.getCurrentPageIndex() ?? 0) {
    if (!manifest || !flip) return [];
    if (flip.getOrientation() === 'portrait' || index === 0 || index === manifest.pages.length - 1) return [index];
    const left = index % 2 === 0 ? index - 1 : index;
    return [left, left + 1].filter(i => i >= 0 && i < manifest.pages.length);
  }

  function spreadFor(index) {
    if (flip.getOrientation() === 'portrait' || index === 0 || index === manifest.pages.length - 1) return index;
    return index % 2 === 0 ? index - 1 : index;
  }

  function updateControls() {
    const current = flip?.getCurrentPageIndex() ?? 0;
    previous.disabled = state !== 'open' || turning || current === 0;
    next.disabled = state !== 'open' || turning || !manifest || current >= manifest.pages.length - 1;
    closeButton.disabled = state === 'closing';
  }

  function describePages() {
    if (!flip || !manifest) return;
    const indices = visibleIndices();
    const current = flip.getCurrentPageIndex();
    reader.dataset.cover = current === 0 ? 'front' : current === manifest.pages.length - 1 ? 'back' : 'none';
    const labels = indices.map(i => manifest.pages[i].label);
    position.textContent = labels.join(' · ');
    transcript.replaceChildren(...indices.map(i => {
      const section = document.createElement('section');
      const title = document.createElement('h3');
      title.textContent = manifest.pages[i].label;
      const text = document.createElement('p');
      text.textContent = manifest.pages[i].text || manifest.pages[i].title || manifest.pages[i].label;
      section.append(title, text);
      return section;
    }));
    updateControls();
  }

  function ensurePage(index) {
    if (index < 0 || index >= manifest.pages.length) return Promise.resolve();
    if (pageLoads.has(index)) return pageLoads.get(index);
    const image = pageImages[index];
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => fail(), 15000);
      function clean() { clearTimeout(timer); image.onload = image.onerror = null; }
      function fail() { clean(); if (pageLoads.get(index) === promise) pageLoads.delete(index); reject(new Error('A book page could not be loaded. Please try again.')); }
      image.onload = () => { clean(); resolve(); };
      image.onerror = fail;
      image.src = new URL(manifest.pages[index].src, assetRoot).href;
      if (image.complete && image.naturalWidth) { clean(); resolve(); }
    });
    pageLoads.set(index, promise);
    return promise;
  }

  function ensureAround(index, distance = 2) {
    return Promise.all(Array.from({ length: distance * 2 + 1 }, (_, n) => ensurePage(index + n - distance)));
  }

  function syncLayout(force = false) {
    const width = reader.clientWidth;
    // Page content and mobile browser chrome can change height without resizing
    // the book. Redrawing for those events disrupts an in-progress page turn.
    if (width === readerWidth && force !== true) return;
    if (width !== readerWidth && force !== true) finishLayoutMotion();
    if (flip && flip.getState() !== 'read') {
      // Complete the old spread before a width change switches page orientation.
      flip.getRender().finishAnimation();
      flipWaiter?.();
    }
    readerWidth = width;
    reader.classList.toggle('reader-portrait', width < 720);
    if (flip) { flip.update(); describePages(); }
  }

  async function initialize() {
    if (initialized) return initialized;
    initialized = (async () => {
      const [library, response] = await Promise.all([
        import('./assets/vendor/page-flip-2.0.7.js'),
        fetch(new URL('manifest.json', assetRoot)),
      ]);
      if (!response.ok) throw new Error('The book could not be loaded. Please try again.');
      manifest = await response.json();
      if (!Array.isArray(manifest.pages) || !manifest.pages.length) throw new Error('The book is unavailable.');
      pageLoads.clear();
      pageImages.length = 0;
      const pages = manifest.pages.map((page, index) => {
        const element = document.createElement('div');
        element.className = 'reader-page';
        element.dataset.density = page.density === 'hard' ? 'hard' : 'soft';
        element.setAttribute('aria-hidden', 'true');
        const image = document.createElement('img');
        image.width = page.width; image.height = page.height;
        image.alt = ''; image.draggable = false;
        pageImages[index] = image;
        element.append(image);
        return element;
      });
      await ensureAround(2, 4);
      flip = new library.PageFlip(host, {
        width: 550, height: 425, size: 'stretch', minWidth: 360, maxWidth: 1100,
        minHeight: 100, maxHeight: 850, autoSize: false, usePortrait: true,
        showCover: true, drawShadow: true, maxShadowOpacity: .32,
        flippingTime: 560, useMouseEvents: false, showPageCorners: false,
        mobileScrollSupport: false, startPage: 0,
      });
      flip.on('flip', describePages);
      flip.on('changeOrientation', describePages);
      flip.on('changeState', event => {
        if (event.data === 'read' && flipWaiter) flipWaiter();
      });
      flip.loadFromHTML(pages);
      syncLayout(true);
      describePages();
    })().catch(cause => { initialized = null; throw cause; });
    return initialized;
  }

  async function animateTo(index, token) {
    await ensureAround(index);
    if (token !== generation) return;
    if (flip.getCurrentPageIndex() === spreadFor(index)) return;
    if (reducedMotion.matches) { flip.turnToPage(index); describePages(); return; }
    await new Promise(resolve => {
      let timer;
      const done = () => {
        clearTimeout(timer);
        if (flipWaiter === done) flipWaiter = null;
        resolve();
      };
      flipWaiter = done;
      // A bounded fallback also covers a tab becoming hidden during a turn.
      timer = setTimeout(() => { flip.getRender().finishAnimation(); done(); }, 1000);
      flip.flip(index, 'bottom');
    });
    describePages();
  }

  function showError(cause) {
    error.textContent = cause.message || 'The book could not be loaded. Please try again.';
    error.hidden = false;
  }

  async function openBook() {
    if (state !== 'closed') return;
    const token = ++generation;
    holdProductHeight();
    error.hidden = true;
    hint.textContent = 'Opening the book…';
    setState('opening');
    operation = (async () => {
      try {
        await Promise.all([relocateBook(true), initialize()]);
        if (token !== generation) return;
        flip.turnToPage(0);
        reader.dataset.cover = 'front';
        reader.dataset.revealed = 'true';
        host.setAttribute('aria-hidden', 'false');
        host.tabIndex = 0;
        host.focus({ preventScroll: true });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (token !== generation) return;
        // Open once to page 1; readers choose when to move further into the book.
        const firstPage = manifest.pages.findIndex(page => page.printedPage === 1);
        reader.dataset.cover = 'none';
        await animateTo(Math.max(1, firstPage), token);
        if (token !== generation) return;
        setState('open');
        hint.textContent = flip.getOrientation() === 'portrait'
          ? 'Tap either side to turn a page. Pinch to zoom. Tap outside to close.'
          : 'Click the left page to go back, or the right page to go forward. Click outside to close.';
        ensureAround(flip.getCurrentPageIndex(), 4).catch(() => {});
      } catch (cause) {
        if (token !== generation) return;
        await resetClosed(false);
        showError(cause);
      }
    })();
    await operation;
  }

  async function resetClosed(restoreFocus) {
    holdProductHeight();
    reader.dataset.revealed = 'false';
    reader.dataset.cover = 'front';
    host.setAttribute('aria-hidden', 'true');
    host.tabIndex = -1;
    transcript.replaceChildren();
    turning = false;
    setState('closing');
    toolbar.hidden = true;
    await relocateBook(false);
    setState('closed');
    hint.textContent = 'Click the cover to open';
    if (restoreFocus || host.contains(document.activeElement)) trigger.focus({ preventScroll: true });
  }

  async function closeBook(restoreFocus = false) {
    if (state === 'closed' || state === 'closing') return;
    const token = ++generation;
    holdProductHeight();
    if (reader.dataset.revealed !== 'true') { await resetClosed(restoreFocus); return; }
    setState('closing');
    hint.textContent = 'Closing the book…';
    await operation;
    if (token !== generation) return;
    try {
      reader.dataset.cover = 'front';
      await animateTo(0, token);
    } catch (cause) {
      showError(cause);
    } finally {
      if (token === generation) await resetClosed(restoreFocus);
    }
  }

  async function turn(direction) {
    if (state !== 'open' || turning) return;
    const current = flip.getCurrentPageIndex();
    const portrait = flip.getOrientation() === 'portrait';
    const target = portrait ? current + direction : direction < 0 ? Math.max(0, current - 2) : current === 0 ? 1 : current + 2;
    if (target < 0 || target >= manifest.pages.length) return;
    if (target === 0) { closeBook(true); return; }
    const token = generation;
    turning = true; error.hidden = true; updateControls();
    reader.setAttribute('aria-busy', 'true');
    operation = (async () => {
      try {
        reader.dataset.cover = target === manifest.pages.length - 1 ? 'back' : 'none';
        await animateTo(target, token);
        if (token === generation) ensureAround(target, 4).catch(() => {});
      } catch (cause) { if (token === generation) showError(cause); }
      finally {
        if (token === generation) {
          turning = false;
          reader.setAttribute('aria-busy', 'false');
          describePages();
        }
      }
    })();
    await operation;
  }

  function clickBook(event) {
    if (state === 'closed' || !flip || reader.dataset.revealed !== 'true') return;
    const bounds = flip.getBoundsRect(), hostBox = host.getBoundingClientRect();
    let left = hostBox.left + bounds.left, right = left + bounds.width;
    const index = flip.getCurrentPageIndex();
    if (flip.getOrientation() === 'portrait' || index === 0) left += bounds.pageWidth;
    else if (index === manifest.pages.length - 1) right -= bounds.pageWidth;
    const top = hostBox.top + bounds.top;
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > top + bounds.height) {
      closeBook(); return;
    }
    if (state === 'open' && !turning) {
      const backCover = flip.getOrientation() === 'landscape' && index === manifest.pages.length - 1;
      turn(backCover || event.clientX < (left + right) / 2 ? -1 : 1);
    }
  }

  trigger.disabled = false;
  trigger.addEventListener('click', openBook);
  stage.addEventListener('click', event => {
    if (!event.target.closest('.reader-cover')) clickBook(event);
  });
  previous.addEventListener('click', () => turn(-1));
  next.addEventListener('click', () => turn(1));
  closeButton.addEventListener('click', () => closeBook(true));
  document.addEventListener('click', event => {
    if (state !== 'closed' && !event.target.closest('[data-reader-interaction]')) closeBook();
  });
  document.addEventListener('keydown', event => {
    if (state === 'closed') return;
    if (event.key === 'Escape') { event.preventDefault(); closeBook(true); }
    else if (reader.contains(document.activeElement) && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault(); turn(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) finishLayoutMotion();
    if (reducedMotion.matches && flip) { flip.getRender().finishAnimation(); flipWaiter?.(); }
  });
  window.addEventListener('resize', () => { finishLayoutMotion(); syncLayout(); }, { passive: true });
  window.addEventListener('scroll', () => {
    if (layoutMotion) {
      layoutMotion.image.style.top = `${layoutMotion.top + layoutMotion.scrollY - window.scrollY}px`;
    }
  }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(syncLayout).observe(reader);
  syncLayout();
}
