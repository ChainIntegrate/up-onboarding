// Storing a file on ChainIntegrate's IPFS node (Kubo), through its RPC API: POST <api>/api/v0/add, pinned, CID
// version 1. The same node serves the files through its public gateway, ipfs.chainintegrate.it.
//   UPIpfs.add(api, bytes, { filename, type, auth })  ->  "ipfs://<cid>"
// api: the node's API address (http://127.0.0.1:5001 on the node's own machine, or its proxied https address);
// auth: an optional Authorization header value, when the API sits behind a proxy that asks for one. The node
// accepts uploads only from its allowed addresses. Browser and Node (fetch, FormData, Blob).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UPIpfs = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";
  async function add(api, bytes, { filename = "file", type = "application/octet-stream", auth = "" } = {}) {
    const fd = new FormData();
    fd.append("file", new Blob([bytes], { type }), filename);
    const url = String(api).replace(/\/+$/, "") + "/api/v0/add?pin=true&cid-version=1&quieter=true";
    const res = await fetch(url, { method: "POST", headers: auth ? { Authorization: auth } : {}, body: fd });
    const text = await res.text();
    if (!res.ok) throw new Error(`IPFS ${res.status} ${text.slice(0, 120)}`);
    // Kubo answers one JSON line per file added; the last one is the file.
    const last = text.trim().split("\n").filter(Boolean).pop();
    let hash;
    try { hash = JSON.parse(last).Hash; } catch (e) { hash = null; }
    if (!hash || !/^[a-zA-Z0-9]{46,100}$/.test(hash)) throw new Error("IPFS: no CID in the answer");
    return "ipfs://" + hash;
  }
  return { add };
});
