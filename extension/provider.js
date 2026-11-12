// The provider a ChainIntegrate project's page sees (EIP-1193), announced with EIP-6963 as "ChainIntegrate Account".
// It runs in the page (world MAIN) and holds nothing: every request goes through bridge.js to the extension, which
// decides. It is announced only once the extension has said that this page belongs to a project of its catalog
// (shared/catalog.js); nothing is set as window.ethereum or window.lukso, so other wallets keep working.
(function () {
  "use strict";
  if (window.__chainIntegrateAccount) return;
  const TAG = "chainintegrate-account";
  const listeners = {};
  const waiting = new Map();
  let seq = 0, ready = false, info = null;

  const emit = (event, value) => (listeners[event] || []).slice().forEach((f) => { try { f(value); } catch (e) { /* the page's */ } });
  function rpcError(e) {
    const err = new Error(e && e.message ? String(e.message) : "Request failed");
    err.code = e && Number.isInteger(e.code) ? e.code : -32603;
    return err;
  }

  const provider = Object.freeze({
    isChainIntegrate: true,
    request(args) {
      const method = args && args.method, params = args && args.params;
      if (typeof method !== "string") return Promise.reject(rpcError({ code: -32600, message: "Invalid request" }));
      if (!ready) return Promise.reject(rpcError({ code: 4900, message: "Disconnected" }));
      const id = ++seq;
      return new Promise((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        window.postMessage({ [TAG]: "request", id, method, params: params === undefined ? [] : params }, location.origin);
      });
    },
    on(event, f) { (listeners[event] = listeners[event] || []).push(f); return provider; },
    removeListener(event, f) { listeners[event] = (listeners[event] || []).filter((g) => g !== f); return provider; },
  });

  function announce() {
    if (!ready) return;
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  }

  window.addEventListener("message", (ev) => {
    if (ev.source !== window || ev.origin !== location.origin || !ev.data || typeof ev.data !== "object") return;
    const m = ev.data;
    if (m[TAG] === "ready" && !ready && m.info) {
      ready = true;
      info = Object.freeze({ uuid: m.info.uuid, name: m.info.name, icon: m.info.icon, rdns: m.info.rdns });
      announce();
    } else if (m[TAG] === "response" && waiting.has(m.id)) {
      const w = waiting.get(m.id); waiting.delete(m.id);
      if (m.error) w.reject(rpcError(m.error)); else w.resolve(m.result);
    } else if (m[TAG] === "event" && typeof m.event === "string") {
      emit(m.event, m.value);
    }
  });
  window.addEventListener("eip6963:requestProvider", announce);
  Object.defineProperty(window, "__chainIntegrateAccount", { value: true });
  window.postMessage({ [TAG]: "hello" }, location.origin);
})();
