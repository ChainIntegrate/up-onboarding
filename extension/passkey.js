// The computer's lock (Windows Hello, Touch ID, a phone, a security key) as the secret that opens the key,
// through WebAuthn's PRF extension: the authenticator gives 32 secret bytes for a given salt, only after the
// person unlocks it. The passkey belongs to this extension's id. shared/keystore.js derives the encryption key
// from those bytes (HKDF-SHA256); nothing here stores them.
//   Passkey.create()      -> { secret, meta: { credId, prfSalt } }   a new passkey and its secret
//   Passkey.secret(meta)  -> secret                                  the same secret again
// Both throw an Error with code "NO_PRF" when the authenticator gives no PRF value (then a password is used),
// "CANCELLED" when the person closes the dialog.
(function () {
  "use strict";
  const b64 = (u8) => ethers.encodeBase64(u8);
  const unb64 = (s) => ethers.getBytes(ethers.decodeBase64(s));
  const fail = (code, e) => Object.assign(new Error(code + (e && e.message ? ": " + e.message : "")), { code, cause: e });
  const prfOf = (cred) => {
    const r = cred.getClientExtensionResults().prf;
    return r && r.results && r.results.first ? new Uint8Array(r.results.first) : null;
  };
  const cancelled = (e) => e && (e.name === "NotAllowedError" || e.name === "AbortError");

  async function get(credId, prfSalt) {
    let cred;
    try {
      cred = await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: credId }],
        userVerification: "required", timeout: 120000,
        extensions: { prf: { eval: { first: prfSalt } } },
      } });
    } catch (e) { throw fail(cancelled(e) ? "CANCELLED" : "FAILED", e); }
    const prf = prfOf(cred);
    if (!prf) throw fail("NO_PRF");
    return prf;
  }

  async function create() {
    if (!window.PublicKeyCredential) throw fail("NO_PRF");
    const prfSalt = crypto.getRandomValues(new Uint8Array(32));
    let cred;
    try {
      cred = await navigator.credentials.create({ publicKey: {
        rp: { name: "ChainIntegrate" },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "ChainIntegrate", displayName: "ChainIntegrate" },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
        timeout: 120000,
        extensions: { prf: { eval: { first: prfSalt } } },
      } });
    } catch (e) { throw fail(cancelled(e) ? "CANCELLED" : "FAILED", e); }
    const ext = cred.getClientExtensionResults().prf;
    if (ext && ext.enabled === false) throw fail("NO_PRF");
    const credId = new Uint8Array(cred.rawId);
    // Some authenticators give the PRF value only on a later get(): ask once more.
    const secret = prfOf(cred) || await get(credId, prfSalt);
    return { secret, meta: { credId: b64(credId), prfSalt: b64(prfSalt) } };
  }

  const secret = (meta) => get(unb64(meta.credId), unb64(meta.prfSalt));

  window.Passkey = { create, secret };
})();
