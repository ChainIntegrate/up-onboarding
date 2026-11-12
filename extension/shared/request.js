// The request file: everything needed to create a client's Universal Profile, public data only.
//
// Written by the client's extension or app (or by the web page itself), read by web/up-create.html, which turns
// it into one LSP23 deployment. The same file is used everywhere, so its checks live here, once:
//   UPRequest.create(fields)  -> { request, errors }   a clean request from the given fields
//   UPRequest.parse(object)   -> { request, errors }   a request read from a file, checked and cleaned
// `request` holds only the known fields, cleaned (addresses checksummed, names on one line, lengths capped);
// `errors` lists what is wrong, as codes ("network", "controllers.1.address", ...); a request with errors must
// not be used. Works in the browser (global UPRequest, after ethers) and in Node (require).
//
// Format, version 1:
// {
//   "kind": "chainintegrate-up-create", "version": 1,
//   "network": "lukso" | "lukso-testnet",
//   "salt": "0x…32 bytes…" (optional: the LSP23 salt, so the UP's address stays the same between sessions),
//   "profile": { "name": "…", "description": "…", "tags": ["…"], "links": [{ "title": "…", "url": "https://…" }] },
//   "images": { "avatar": { "dataUrl": "data:image/…;base64,…", "w": 512, "h": 512 } | null, "cover": … | null },
//   "controllers": [{ "address": "0x…", "name": "…", "role": "admin" | "device" }]
// }
// The account belongs to these keys only: ChainIntegrate never holds a key of it (no recovery key by design).
(function (root, factory) {
  const api = factory(root.ethers || (typeof require === "function" ? require("ethers").ethers : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UPRequest = api;
})(typeof self !== "undefined" ? self : globalThis, function (ethers) {
  "use strict";
  const KIND = "chainintegrate-up-create";
  const VERSION = 1;
  const NETWORKS = ["lukso", "lukso-testnet"];
  const ROLES = ["admin", "device"];
  const LIMITS = { name: 64, description: 1000, tag: 32, tags: 10, linkTitle: 64, url: 512, links: 10, controllers: 20, controllerName: 64, image: 2 * 1024 * 1024 };
  const IMAGE_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

  // One line: no control, zero-width or bidi characters, spaces collapsed, at most `max` characters.
  const BAD = "[\\u0000-\\u0008\\u000b-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]";
  const BAD_ONE_LINE = new RegExp("[\\u0009\\u000a]|" + BAD, "g"), BAD_TEXT = new RegExp(BAD, "g");
  const oneLine = (v, max) => [...String(v == null ? "" : v).replace(BAD_ONE_LINE, " ")
    .replace(/\s+/g, " ").trim()].slice(0, max).join("").trim();
  // Text that keeps its line breaks (the description).
  const text = (v, max) => [...String(v == null ? "" : v).replace(/\r\n?/g, "\n").replace(BAD_TEXT, " ")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()].slice(0, max).join("").trim();

  function httpUrl(u) {
    try { const x = new URL(String(u)); return (x.protocol === "https:" || x.protocol === "http:") && x.hostname ? x.href : null; } catch (e) { return null; }
  }

  function cleanImage(im, key, errors) {
    if (im == null) return null;
    if (typeof im !== "object" || typeof im.dataUrl !== "string" || !IMAGE_RE.test(im.dataUrl) || im.dataUrl.length > LIMITS.image * 1.4) { errors.push(`images.${key}`); return null; }
    const w = Number(im.w), h = Number(im.h);
    return { dataUrl: im.dataUrl, w: Number.isInteger(w) && w > 0 && w <= 10000 ? w : null, h: Number.isInteger(h) && h > 0 && h <= 10000 ? h : null };
  }

  // The checked, cleaned request. `strict` (parse) also checks kind and version.
  function clean(src, strict) {
    const errors = [];
    if (!src || typeof src !== "object" || Array.isArray(src)) return { request: null, errors: ["object"] };
    if (strict && src.kind !== KIND) errors.push("kind");
    if (strict && src.version !== VERSION) errors.push("version");
    const network = NETWORKS.includes(src.network) ? src.network : (errors.push("network"), null);
    let salt;
    if (src.salt != null) {
      if (typeof src.salt === "string" && ethers.isHexString(src.salt, 32)) salt = src.salt.toLowerCase();
      else errors.push("salt");
    }

    const p = src.profile && typeof src.profile === "object" ? src.profile : {};
    const name = oneLine(p.name, LIMITS.name);
    if (!name) errors.push("profile.name");
    const tags = [];
    for (const t of Array.isArray(p.tags) ? p.tags : []) { const c = oneLine(t, LIMITS.tag); if (c && !tags.includes(c)) tags.push(c); }
    if (tags.length > LIMITS.tags) errors.push("profile.tags");
    const links = [];
    (Array.isArray(p.links) ? p.links : []).forEach((l, i) => {
      const url = l && httpUrl(l.url);
      if (!url || url.length > LIMITS.url) { errors.push(`profile.links.${i}`); return; }
      links.push({ title: oneLine(l.title, LIMITS.linkTitle) || new URL(url).hostname, url });
    });
    if (links.length > LIMITS.links) errors.push("profile.links");
    const profile = { name, description: text(p.description, LIMITS.description), tags: tags.slice(0, LIMITS.tags), links: links.slice(0, LIMITS.links) };

    const im = src.images && typeof src.images === "object" ? src.images : {};
    const images = { avatar: cleanImage(im.avatar, "avatar", errors), cover: cleanImage(im.cover, "cover", errors) };

    const controllers = [];
    const seen = new Set();
    const list = Array.isArray(src.controllers) ? src.controllers : [];
    if (list.length > LIMITS.controllers) errors.push("controllers");
    list.slice(0, LIMITS.controllers).forEach((c, i) => {
      const raw = c && typeof c.address === "string" ? c.address.trim() : "";
      if (!ethers.isAddress(raw) || BigInt(raw) === 0n) { errors.push(`controllers.${i}.address`); return; }
      const address = ethers.getAddress(raw);
      if (seen.has(address)) { errors.push(`controllers.${i}.duplicate`); return; }
      seen.add(address);
      if (!ROLES.includes(c.role)) { errors.push(`controllers.${i}.role`); return; }
      controllers.push({ address, name: oneLine(c.name, LIMITS.controllerName), role: c.role });
    });
    if (!controllers.length) errors.push("controllers.none");
    else if (!controllers.some((c) => c.role === "admin")) errors.push("controllers.noAdmin");

    const request = { kind: KIND, version: VERSION, network, profile, images, controllers };
    if (salt) request.salt = salt;
    return { request, errors };
  }

  const create = (fields) => clean(fields, false);
  const parse = (obj) => clean(obj, true);
  // Warnings that do not stop a request: one administrator only (no way back if its key is lost).
  const warnings = (req) => (req && req.controllers.filter((c) => c.role === "admin").length === 1 ? ["controllers.oneAdmin"] : []);

  // The message an administrator key signs (personal_sign) to send a request to the creation service: it binds
  // the exact, cleaned request (JSON.stringify of create's or parse's result, images included) to the key, so the
  // service creates an account only for keys their owner holds. The salt is the service's, not signed.
  function signingMessage(request) {
    const { salt, ...rest } = request;
    return `ChainIntegrate account request\n${ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(rest)))}`;
  }

  return { KIND, VERSION, NETWORKS, ROLES, LIMITS, create, parse, warnings, oneLine, signingMessage };
});
