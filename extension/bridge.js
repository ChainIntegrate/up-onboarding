// Between a project's page (provider.js, in the page) and the extension (background.js). Runs in the extension's
// isolated world on https://*.chainintegrate.it pages, top frame only. It forwards the page's requests and brings
// back the answers; background.js and the confirmation window decide, from the page's origin as Chrome gives it.
(function () {
  "use strict";
  const TAG = "chainintegrate-account";
  if (location.protocol !== "https:" || window.top !== window) return;
  let served = null;
  const toPage = (msg) => window.postMessage({ [TAG]: msg.kind, ...msg }, location.origin);

  // Asked once; "ready" is posted again each time provider.js says hello (the two scripts start in either order).
  async function hello() {
    if (served === null) { try { served = (await chrome.runtime.sendMessage({ kind: "hello" })) || false; } catch (e) { served = false; } }
    if (served && served.ok) toPage({ kind: "ready", info: served.info });
  }

  window.addEventListener("message", async (ev) => {
    if (ev.source !== window || ev.origin !== location.origin || !ev.data || typeof ev.data !== "object") return;
    const m = ev.data;
    if (m[TAG] === "hello") { hello(); return; }
    if (m[TAG] !== "request" || !Number.isInteger(m.id) || typeof m.method !== "string") return;
    let answer;
    try { answer = await chrome.runtime.sendMessage({ kind: "request", id: m.id, method: m.method, params: m.params }); }
    catch (e) { answer = { error: { code: 4900, message: "The extension is not available. Reload the page." } }; }
    // "pending": the answer comes later from the confirmation window (chrome.tabs.sendMessage, below).
    if (answer && answer.pending) return;
    toPage({ kind: "response", id: m.id, ...(answer || { error: { code: -32603, message: "No answer" } }) });
  });

  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (sender.id !== chrome.runtime.id || !msg) return;
    if (msg.kind === "response" && Number.isInteger(msg.id)) toPage({ kind: "response", id: msg.id, result: msg.result, error: msg.error });
    if (msg.kind === "event" && typeof msg.event === "string") toPage({ kind: "event", event: msg.event, value: msg.value });
  });
  hello();
})();
