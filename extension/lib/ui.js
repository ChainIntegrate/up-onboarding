// Shared bits of the pages: the language (Italian or English, the toggle's choice kept in this browser,
// else ?lang=, else the browser's own) and long notes folded to three lines with "Read more".
(function () {
  "use strict";
  const LANG_KEY = "uponboarding.lang";
  const T = { it: { more: "Leggi tutto", less: "Riduci" }, en: { more: "Read more", less: "Show less" } };
  const lang = () => (document.documentElement.lang === "en" ? "en" : "it");
  const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* not kept */ } };

  function initialLang() {
    const v = get(LANG_KEY);
    if (v === "it" || v === "en") return v;
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "it" || q === "en") return q;
    return /^it\b/i.test(navigator.language || "") ? "it" : "en";
  }
  const saveLang = (l) => set(LANG_KEY, l);

  function clampNotes({ root = document, min = 280 } = {}) {
    const s = document.createElement("style");
    s.textContent = `.ui-clamp:not(.ui-open) { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 4px; }
.panel, .panel * { overflow-wrap: anywhere; } .panel { min-width: 0; }
.ui-more { width: auto !important; margin: 0 0 12px !important; padding: 0 !important; background: none !important; color: var(--accent) !important; font-size: 12.5px !important; font-weight: 600; }`;
    document.head.appendChild(s);
    const notes = [...root.querySelectorAll(".panel .note[data-i18n-html], .panel .note[data-i18n]")];
    const refresh = () => {
      for (const n of notes) {
        let b = n.nextElementSibling && n.nextElementSibling.classList.contains("ui-more") ? n.nextElementSibling : null;
        if ((n.textContent || "").length <= min) { n.classList.remove("ui-clamp"); if (b) b.hidden = true; continue; }
        n.classList.add("ui-clamp");
        if (!b) {
          b = document.createElement("button"); b.type = "button"; b.className = "ui-more";
          b.addEventListener("click", () => { n.classList.toggle("ui-open"); b.textContent = T[lang()][n.classList.contains("ui-open") ? "less" : "more"]; });
          n.insertAdjacentElement("afterend", b);
        }
        b.hidden = false;
        b.textContent = T[lang()][n.classList.contains("ui-open") ? "less" : "more"];
      }
    };
    new MutationObserver(() => setTimeout(refresh, 0)).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    refresh();
  }

  window.SiteUI = { initialLang, saveLang, clampNotes };
})();
