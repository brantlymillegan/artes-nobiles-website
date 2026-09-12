/* Matches brantly.com's theme control, adapted to this static site. */
(() => {
  "use strict";

  const storageKey = "artes-nobiles-theme";
  const themes = ["system", "light", "dark"];
  const labels = { system: "System", light: "Light", dark: "Dark" };
  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let openMode = "closed";
  let control;
  let trigger;
  let options;

  function readPreference() {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === "light" || saved === "dark" ? saved : "system";
    } catch {
      return "system";
    }
  }

  let theme = readPreference();

  function applyDocumentTheme() {
    if (theme === "system") root.removeAttribute("data-theme");
    else root.dataset.theme = theme;
    const dark = theme === "dark" || (theme === "system" && systemTheme.matches);
    document.querySelector("#theme-color")?.setAttribute("content", dark ? "#252a32" : "#f6f4ef");
  }

  // Runs in the head before CSS paints, avoiding a flash of the wrong theme.
  applyDocumentTheme();
  systemTheme.addEventListener("change", applyDocumentTheme);

  const iconPaths = {
    system: '<rect x="1.25" y="2" width="11.5" height="8" rx="1.25"/><path d="M5 12h4M7 10v2"/>',
    light: '<circle cx="7" cy="7" r="2.25"/><path d="M7 1v1.25M7 11.75V13M1 7h1.25M11.75 7H13M2.76 2.76l.88.88M10.36 10.36l.88.88M11.24 2.76l-.88.88M3.64 10.36l-.88.88"/>',
    dark: '<path d="M11.9 9.16A5.25 5.25 0 0 1 4.84 2.1 5.25 5.25 0 1 0 11.9 9.16Z"/>',
  };

  function icon(value) {
    return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${iconPaths[value]}</svg>`;
  }

  function setOpenMode(nextMode) {
    openMode = nextMode;
    const isOpen = openMode !== "closed";
    control.classList.toggle("is-open", isOpen);
    trigger.setAttribute("aria-expanded", String(isOpen));
    const action = openMode === "closed" ? "Open theme options" : openMode === "hover" ? "Keep theme options open" : "Theme options pinned open";
    trigger.setAttribute("aria-label", `${labels[theme]} theme. ${action}`);
    options.setAttribute("aria-hidden", String(!isOpen));
    for (const button of options.querySelectorAll("button")) button.tabIndex = isOpen ? 0 : -1;
  }

  function renderControl() {
    control.dataset.activeTheme = theme;
    trigger.title = `${labels[theme]} theme`;
    trigger.querySelector(".theme-trigger-symbol").innerHTML = icon(theme);
    options.replaceChildren();
    for (const value of themes.filter(value => value !== theme)) {
      const button = document.createElement("button");
      button.className = "theme-option";
      button.type = "button";
      button.title = value === "system" ? "System" : `${labels[value]} mode`;
      button.setAttribute("aria-label", `Use ${value} theme`);
      button.innerHTML = `<span class="theme-symbol" aria-hidden="true">${icon(value)}</span>`;
      button.addEventListener("click", () => chooseTheme(value));
      options.append(button);
    }
    setOpenMode(openMode);
  }

  function chooseTheme(value) {
    theme = value;
    try {
      if (theme === "system") window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, theme);
    } catch {
      // The selection still works for this visit when storage is unavailable.
    }
    applyDocumentTheme();
    renderControl();
    setOpenMode("closed");
    trigger.focus();
  }

  window.addEventListener("storage", event => {
    if (event.key !== storageKey && event.key !== null) return;
    theme = readPreference();
    applyDocumentTheme();
    if (control) renderControl();
  });

  document.addEventListener("DOMContentLoaded", () => {
    control = document.querySelector(".theme-toggle");
    trigger = control.querySelector(".theme-trigger");
    options = control.querySelector(".theme-menu-options");
    renderControl();
    control.hidden = false;

    trigger.addEventListener("click", () => setOpenMode("pinned"));
    control.addEventListener("pointerenter", event => {
      if (event.pointerType === "mouse" && openMode !== "pinned") setOpenMode("hover");
    });
    control.addEventListener("pointerleave", event => {
      if (event.pointerType === "mouse" && openMode === "hover") setOpenMode("closed");
    });
    document.addEventListener("pointerdown", event => {
      if (!control.contains(event.target)) setOpenMode("closed");
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && openMode !== "closed") {
        setOpenMode("closed");
        trigger.focus();
      }
    });
  });
})();
