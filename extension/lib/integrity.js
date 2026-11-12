// The extension's own files checked against what ChainIntegrate published (Cross_Chain audit EXT-06).
//
// Chrome does not check an extension loaded from a folder, so the extension compares its own code (html, js, json)
// with the SHA-256 that ChainIntegrate's site publishes for this version, and refuses to unlock the key when a file
// differs. It catches a corrupted, half-updated or crudely modified copy; code rewritten on purpose could also
// rewrite this check, so the complete protection is the Chrome Web Store (Chrome verifies its files) and
// tools/verify-extension.js from outside. When the list cannot be fetched (offline), the state is "unknown" and the
// extension works.
//   Integrity.check() -> Promise<{ state: "ok" | "bad" | "unknown", bad: [files] }>   (one check per page)
(function () {
  "use strict";
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  let running = null;
  async function run() {
    let text;
    try {
      const res = await fetch(CONFIG.sums + chrome.runtime.getManifest().version + "/SHA256SUMS", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      text = await res.text();
    } catch (e) { return { state: "unknown", bad: [] }; }
    const bad = [];
    for (const line of text.split("\n")) {
      const m = line.match(/^([0-9a-f]{64}) {2}chainintegrate-account\/(.+\.(?:js|html|json))$/);
      if (!m) continue;
      try {
        const got = hex(await crypto.subtle.digest("SHA-256", await (await fetch(chrome.runtime.getURL(m[2]), { cache: "no-store" })).arrayBuffer()));
        if (got !== m[1]) bad.push(m[2]);
      } catch (e) { bad.push(m[2]); }
    }
    return { state: bad.length ? "bad" : "ok", bad };
  }
  window.Integrity = { check: () => (running = running || run()) };
})();
