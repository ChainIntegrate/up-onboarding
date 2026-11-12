// Operations on an account with the gas paid by ChainIntegrate's service: LSP25 `executeRelayCall`.
//
// One of the account's keys signs, for the account's Key Manager (LSP6), a call to the account, its nonce and a
// validity window; the service sends it and pays. Shared by the extension (to build and sign) and the service (to
// check before sending), so the two agree on what may be sent:
//   UPRelay.digest({ chainId, keyManager, nonce, validity, value, payload })  the hash the key signs
//   UPRelay.validity(start, end)                                              LSP25's two uint128 in one uint256
//   UPRelay.decode(payload)                                                   { fn, keys, values } or { fn, call }
//   UPRelay.check(payload, { signer })                                        { ok, items } or { ok: false, error }
//
// What may be sent (the rest is refused, whoever signs):
//   - the profile: setData(LSP3Profile, a VerifiableURI with keccak256(utf8) and an ipfs:// URL);
//   - the signer's own name on the account: setData(the name key of the signer, UTF-8 text, at most 64 chars);
//   - setDataBatch made only of the two above.
// Calls of ChainIntegrate's projects (execute) come with their catalog (docs/integration.md, section 5).
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

  // { ok: true, items: [{ op: "profile", url } | { op: "deviceName", name }] } or { ok: false, error }.
  function check(payload, { signer }) {
    const d = decode(payload);
    if (!d) return { ok: false, error: "payload" };
    if (d.fn === "execute") return { ok: false, error: "not_in_catalog" };
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

  return { LSP25_VERSION, LSP3_KEY, nameKey, UP, KM, validity, splitValidity, digest, decode, check, profileValue };
});
