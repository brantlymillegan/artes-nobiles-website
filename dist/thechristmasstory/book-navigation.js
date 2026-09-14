const header = document.querySelector('.book-site-header');
const toggle = header?.querySelector('.mobile-menu-toggle');
const links = header?.querySelector('.product-links');

if (toggle && links) {
  const mobile = matchMedia('(max-width: 719px)');

  function setOpen(open) {
    const expanded = mobile.matches && open;
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? 'Close menu' : 'Open menu');
    links.inert = mobile.matches && !expanded;
  }

  function syncViewport() {
    const focusedLink = links.contains(document.activeElement);
    const focusedToggle = document.activeElement === toggle;
    toggle.hidden = !mobile.matches;
    setOpen(false);
    if (mobile.matches && focusedLink) toggle.focus({ preventScroll: true });
    else if (!mobile.matches && focusedToggle) links.querySelector('a')?.focus({ preventScroll: true });
  }

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', event => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('pointerdown', event => {
    if (!header.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      // Let the nested appearance control handle its own first Escape.
      if (links.querySelector('.theme-toggle.is-open')) return;
      event.preventDefault();
      setOpen(false);
      toggle.focus({ preventScroll: true });
    }
  });
  header.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
      if (!header.contains(document.activeElement)) setOpen(false);
    });
  });
  mobile.addEventListener('change', syncViewport);
  syncViewport();
  header.classList.add('has-menu');
}
