// Operations on an account with the gas paid by ChainIntegrate's service: LSP25 `executeRelayCall`.
//
// One of the account's keys signs, for the account's Key Manager (LSP6), a call to the account, its nonce and a
// validity window; the service sends it and pays. Shared by the extension (to build and sign) and the service (to
// check before sending), so the two agree on what may be sent:
//   UPRelay.digest({ chainId, keyManager, nonce, validity, value, payload })  the hash the key signs
//   UPRelay.validity(start, end)                                              LSP25's two uint128 in one uint256
//   UPRelay.decode(payload)                                                   { fn, keys, values } or { fn, call }
//   UPRelay.check(payload, { signer, chainId })                               { ok, items } or { ok: false, error }
//
// What may be sent (the rest is refused, whoever signs):
//   - the profile: setData(LSP3Profile, a VerifiableURI with keccak256(utf8) and an ipfs:// URL);
//   - the signer's own name on the account: setData(the name key of the signer, UTF-8 text, at most 64 chars);
//   - setDataBatch made only of the two above;
//   - a device authorized (addDevice) or revoked (removeDevice): the exact setDataBatch that addDevice() and
//     removeDevice() build, for a controller of role "admin" (ADMIN_PERMS) or "access" (ACCESS_PERMS). check() gives
//     what it reads from the payload; the caller compares it with the account on the network (current list of
//     keys) and rebuilds the payload to compare byte for byte. The Key Manager also requires the signer to be an
//     administrator (ADDCONTROLLER, EDITPERMISSIONS).
//   - execute(CALL, target, 0, data) of a call in the catalog of ChainIntegrate's projects (shared/catalog.js); its
//     on-chain checks (`needs`, e.g. "a registry made by the project's factory") are the caller's to make.
//
// LSP25 (LUKSO's lsp-smart-contracts, LSP25MultiChannelNonce): the signed hash is
//   keccak256(0x19 0x00 ‖ keyManager ‖ abi.encodePacked(25, chainId, nonce, validityTimestamps, value, payload)),
// EIP-191 version 0 with the Key Manager as the intended validator; the signer needs EXECUTE_RELAY_CALL.
(function (root, factory) {
  const api = factory(root.ethers || (typeof require === "function" ? require("ethers").ethers : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UPRelay = api;
})(typeof self !== "undefined" ? self : globalThis, function (ethers) {
  "use strict";
  const LSP25_VERSION = 25n;
  const LSP3_KEY = "0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5";
  const NAME_PREFIX = "0x344e172b69e28979f8df0000"; // UPWalletControllerName mapping, as shared/deploy.js
  const nameKey = (a) => NAME_PREFIX + a.slice(2).toLowerCase();
  // LSP6 keys of the controllers' list, as shared/deploy.js writes them at the creation.
  const ARRAY_KEY = "0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3"; // AddressPermissions[]
  const indexKey = (i) => ARRAY_KEY.slice(0, 34) + BigInt(i).toString(16).padStart(32, "0");
  const permKey = (a) => "0x4b80742de2bf82acb3630000" + a.slice(2).toLowerCase();
  const dataKeysKey = (a) => "0x4b80742de2bf866c29110000" + a.slice(2).toLowerCase();
  // Administrator: as at the creation (shared/deploy.js). Access: SUPER_CALL (the relay allows only the catalog's
  // calls), SETDATA limited to its own name on the account, SIGN, EXECUTE_RELAY_CALL; no transfer of value, no
  // change to the profile or to the keys (maintainer's decision, 2026-11-13). The same as shared/deploy.js gives a
  // "device" at the creation.
  const ADMIN_PERMS = 0x7f3f06n;
  const ACCESS_PERMS = 0x400n | 0x40000n | 0x200000n | 0x400000n;
  const ROLE_PERMS = { admin: ADMIN_PERMS, access: ACCESS_PERMS };
  const permValue = (p) => ethers.zeroPadValue(ethers.toBeHex(p), 32);
  const accessDataKeys = (a) => ethers.concat(["0x0020", nameKey(a)]);
  const UP = new ethers.Interface([
    "function setData(bytes32 dataKey, bytes dataValue)",
    "function setDataBatch(bytes32[] dataKeys, bytes[] dataValues)",
    "function execute(uint256 operationType, address target, uint256 value, bytes data) returns (bytes)",
  ]);
  const KM = new ethers.Interface([
    "function executeRelayCall(bytes signature, uint256 nonce, uint256 validityTimestamps, bytes payload) payable returns (bytes)",
    "function getNonce(address from, uint128 channelId) view returns (uint256)",
  ]);

  function validity(start, end) {
    const s = BigInt(start), e = BigInt(end);
    if (s < 0n || e < 0n || s >= 1n << 128n || e >= 1n << 128n) throw new Error("validity");
    return (s << 128n) | e;
  }
  const splitValidity = (v) => ({ start: BigInt(v) >> 128n, end: BigInt(v) & ((1n << 128n) - 1n) });

  function digest({ chainId, keyManager, nonce, validity: v, value = 0n, payload }) {
    const message = ethers.solidityPacked(["uint256", "uint256", "uint256", "uint256", "uint256", "bytes"], [LSP25_VERSION, chainId, nonce, v, value, payload]);
    return ethers.keccak256(ethers.concat(["0x1900", ethers.getAddress(keyManager), message]));
  }

  function decode(payload) {
    let tx;
    try { tx = UP.parseTransaction({ data: payload }); } catch (e) { return null; }
    if (!tx) return null;
    if (tx.name === "setData") return { fn: "setData", keys: [tx.args[0]], values: [tx.args[1]] };
    if (tx.name === "setDataBatch") return { fn: "setDataBatch", keys: [...tx.args[0]], values: [...tx.args[1]] };
    return { fn: "execute", call: { operation: tx.args[0], target: tx.args[1], value: tx.args[2], data: tx.args[3] } };
  }

  // A profile value: the VerifiableURI of a JSON on IPFS (as shared/deploy.js writes it).
  function profileValue(v) {
    try {
      const b = ethers.getBytes(v);
      if (b.length < 40 || ethers.hexlify(b.slice(0, 8)) !== "0x00006f357c6a0020") return null;
      const url = ethers.toUtf8String(b.slice(40));
      return /^ipfs:\/\/[a-zA-Z0-9]{46,100}$/.test(url) ? { hash: ethers.hexlify(b.slice(8, 40)), url } : null;
    } catch (e) { return null; }
  }
  function nameValue(v) {
    try {
      const s = ethers.toUtf8String(v);
      return s.length >= 1 && s.length <= 64 && !/[\u0000-\u001f\u007f-\u009f]/.test(s) && s.trim() === s ? s : null;
    } catch (e) { return null; }
  }

  // A new device on the account: `length` is the current length of the account's list of keys.
  function addDevice({ length, address, role, name }) {
    const a = ethers.getAddress(address), n = BigInt(length);
    if (!ROLE_PERMS[role]) throw new Error("role");
    const nm = nameValue(ethers.hexlify(ethers.toUtf8Bytes(String(name || ""))));
    if (nm === null) throw new Error("name");
    const keys = [ARRAY_KEY, indexKey(n), permKey(a)], values = [ethers.toBeHex(n + 1n, 16), a, permValue(ROLE_PERMS[role])];
    if (role === "access") { keys.push(dataKeysKey(a)); values.push(accessDataKeys(a)); }
    keys.push(nameKey(a)); values.push(ethers.hexlify(ethers.toUtf8Bytes(nm)));
    return UP.encodeFunctionData("setDataBatch", [keys, values]);
  }
  // A device removed: `list` is the account's list of keys, in order; the last one takes its place.
  function removeDevice({ list, address }) {
    const a = ethers.getAddress(address), all = list.map((x) => ethers.getAddress(x));
    const i = all.indexOf(a), last = all.length - 1;
    if (i < 0) throw new Error("not in the list");
    const keys = [], values = [];
    if (i !== last) { keys.push(indexKey(i)); values.push(all[last]); }
    keys.push(indexKey(last), ARRAY_KEY, permKey(a), dataKeysKey(a), nameKey(a));
    values.push("0x", ethers.toBeHex(BigInt(last), 16), "0x", "0x", "0x");
    return UP.encodeFunctionData("setDataBatch", [keys, values]);
  }
  // What a device change says: { op: "addDevice", address, role, name, length } or { op: "removeDevice", address,
  // length } (the list's current length), or null when the batch is not one.
  function readDeviceChange(keys, values) {
    const ks = keys.map((k) => String(k).toLowerCase());
    const perms = ks.filter((k) => k.startsWith("0x4b80742de2bf82acb3630000"));
    if (perms.length !== 1 || !ks.includes(ARRAY_KEY)) return null;
    const address = ethers.getAddress("0x" + perms[0].slice(26));
    const pv = values[ks.indexOf(perms[0])], lv = values[ks.indexOf(ARRAY_KEY)];
    let length;
    try { if (ethers.getBytes(lv).length !== 16) return null; length = BigInt(lv); } catch (e) { return null; }
    if (length > 1000n) return null;
    if (pv && pv !== "0x") {
      let perm; try { perm = BigInt(pv); } catch (e) { return null; }
      const role = Object.keys(ROLE_PERMS).find((r) => ROLE_PERMS[r] === perm);
      const nv = ks.includes(nameKey(address)) ? nameValue(values[ks.indexOf(nameKey(address))]) : null;
      if (!role || nv === null || length < 1n) return null;
      return { op: "addDevice", address, role, name: nv, length: Number(length - 1n) };
    }
    return { op: "removeDevice", address, length: Number(length + 1n) };
  }

  // { ok: true, items: [{ op: "profile", url } | { op: "deviceName", name } | { op: "addDevice", … } |
  //   { op: "removeDevice", … }] } or { ok: false, error }.
  function check(payload, { signer, chainId } = {}) {
    const d = decode(payload);
    if (!d) return { ok: false, error: "payload" };
    if (d.fn === "execute") {
      const cat = catalog();
      if (!cat || d.call.operation !== 0n) return { ok: false, error: "not_in_catalog" };
      if (UP.encodeFunctionData("execute", [d.call.operation, d.call.target, d.call.value, d.call.data]).toLowerCase() !== String(payload).toLowerCase()) return { ok: false, error: "payload" };
      const c = cat.call({ chainId, to: d.call.target, data: d.call.data, value: d.call.value });
      if (!c.ok) return c;
      return { ok: true, items: [{ op: "project", project: c.project, fn: c.fn, target: ethers.getAddress(d.call.target) }], needs: c.needs, said: c };
    }
    if (d.fn === "setDataBatch" && d.keys.map((k) => String(k).toLowerCase()).includes(ARRAY_KEY)) {
      const c = d.keys.length === d.values.length ? readDeviceChange(d.keys, d.values) : null;
      if (!c) return { ok: false, error: "device_change" };
      if (c.op === "removeDevice" && signer && c.address === ethers.getAddress(signer)) return { ok: false, error: "own_key" };
      if (c.op === "addDevice") {
        let same = false;
        try { same = addDevice(c).toLowerCase() === String(payload).toLowerCase(); } catch (e) { same = false; }
        if (!same) return { ok: false, error: "device_change" };
      }
      return { ok: true, items: [c] };
    }
    if (!d.keys.length || d.keys.length > 4 || d.keys.length !== d.values.length) return { ok: false, error: "payload" };
    const items = [];
    const seen = new Set();
    for (let i = 0; i < d.keys.length; i++) {
      const k = String(d.keys[i]).toLowerCase(), v = d.values[i];
      if (seen.has(k)) return { ok: false, error: "payload" };
      seen.add(k);
      if (k === LSP3_KEY) {
        const p = profileValue(v);
        if (!p) return { ok: false, error: "profile_value" };
        items.push({ op: "profile", url: p.url });
      } else if (signer && k === nameKey(ethers.getAddress(signer))) {
        const n = nameValue(v);
        if (n === null) return { ok: false, error: "name_value" };
        items.push({ op: "deviceName", name: n });
      } else {
        return { ok: false, error: "not_allowed" };
      }
    }
    return { ok: true, items };
  }

  // shared/catalog.js: loaded next to this file (the extension's pages, the service).
  function catalog() {
    const g = typeof self !== "undefined" ? self : globalThis;
    if (g.UPCatalog) return g.UPCatalog;
    try { return typeof require === "function" ? require("./catalog.js") : null; } catch (e) { return null; }
  }
  // A call of a project's contract from the account.
  const projectCall = (to, data) => UP.encodeFunctionData("execute", [0, ethers.getAddress(to), 0, data]);

  // The calls the extension sends for the account's own changes.
  const setProfile = (value) => UP.encodeFunctionData("setData", [LSP3_KEY, value]);
  const setName = (signer, name) => UP.encodeFunctionData("setData", [nameKey(ethers.getAddress(signer)), ethers.hexlify(ethers.toUtf8Bytes(name))]);

  return { LSP25_VERSION, LSP3_KEY, nameKey, UP, KM, validity, splitValidity, digest, decode, check, profileValue, setProfile, setName, projectCall,
    ARRAY_KEY, indexKey, permKey, dataKeysKey, ADMIN_PERMS, ACCESS_PERMS, addDevice, removeDevice };
});
