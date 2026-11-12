// Light / dark theme of the pages. Loaded in <head> so the saved choice applies before the page paints.
// The pages define ChainIntegrate's light look (from its logo) as CSS variables on :root; the dark theme
// redefines the same variables on html[data-theme="dark"], which wins over :root.
// The choice is kept in this browser only (localStorage); without it the pages are light.
(function () {
  const KEY = "uponboarding.theme";
  const saved = (() => { try { return localStorage.getItem(KEY); } catch (e) { return null; } })();
  const root = document.documentElement;
  root.setAttribute("data-theme", saved === "dark" ? "dark" : "light");

  const css = `
html[data-theme="dark"] {
  --bg: #111517; --panel: #1a2023; --border: #2b353a; --field: #12171a; --chip: #25323a; --disabled: #3a464d; --raised: #1f272b;
  --text: #e6ecee; --text-dim: #9aabb3;
  --brand: #22b8c9; --slate: #8fb4c3; --accent: #4fd0de; --btn: #11808d;
  --ok: #3fbf6f; --warn: #e0a83c; --err: #e05a5a;
  color-scheme: dark;
}
html[data-theme="light"] { color-scheme: light; }
html[data-theme="light"] button:disabled { color: var(--text-dim); }
button.secondary, #langToggle, .theme-btn { color: var(--text); }
.theme-btn { color: var(--text); }
.theme-btn { width: auto !important; flex-shrink: 0; cursor: pointer; background: var(--chip); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px; padding: 6px 12px; font-size: 14px; line-height: 1.2; margin: 0; font-weight: 600; }
.theme-wrap { display: flex; gap: 8px; align-items: flex-start; flex-shrink: 0; }
.theme-btn.floating { position: fixed; top: 12px; right: 12px; z-index: 50; }`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const label = () => {
    const light = root.getAttribute("data-theme") === "light";
    const en = root.lang === "en";
    return { icon: light ? "☾" : "☀", title: light ? (en ? "Dark theme" : "Tema scuro") : (en ? "Light theme" : "Tema chiaro") };
  };
  function place() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "themeToggle";
    const render = () => { const l = label(); btn.textContent = l.icon; btn.title = l.title; btn.setAttribute("aria-label", l.title); };
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* not saved: the choice lasts for this page only */ }
      render();
    });
    // Next to the language button when the page has one (same look), otherwise in the corner.
    btn.className = "theme-btn";
    const lang = document.getElementById("langToggle");
    const bar = document.querySelector(".langbar");
    if (lang) {
      // A wrapper keeps the header's layout: the two buttons sit together where the language one was.
      const wrap = document.createElement("div");
      wrap.className = "theme-wrap";
      lang.parentNode.insertBefore(wrap, lang);
      wrap.append(btn, lang);
    } else if (bar) {
      bar.insertBefore(btn, bar.firstChild);
    } else {
      btn.classList.add("floating");
      document.body.appendChild(btn);
    }
    render();
    new MutationObserver(render).observe(root, { attributes: true, attributeFilter: ["lang"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", place); else place();
})();
