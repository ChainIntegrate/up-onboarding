// The client's keys: created on the device, kept only encrypted, opened one signature at a time.
//
// Shared by the browser extension and the Android app; it has no browser or Android code (only WebCrypto,
// available in both and in Node, and ethers). The passkey's WebAuthn calls and the Android Keystore stay in
// each app, which pass here the secret they obtain.
//
// A key record (what each app stores):
//   { v: 1, address, method: "password", kdf: { name: "PBKDF2-SHA256", rounds, salt }, iv, ct }
//   { v: 1, address, method: "secret", hkdf: { name: "HKDF-SHA256", salt, info }, iv, ct, meta }
// - "password": AES-256-GCM key from PBKDF2-SHA256 (600,000 rounds) of a password that passes passwordProblem():
//   at least 20 characters (a sentence is fine), or at least 14 mixing three kinds of characters (lower case, upper
//   case, digits, others), as GasTrace asks; at least 8 different characters, no character 4 times in a row, no
//   run of 6 consecutive letters or digits (abcdef, 123456), not a short block repeated (audit A14, U-05). Records
//   sealed before with a shorter password still open;
// - "secret": AES-256-GCM key from HKDF-SHA256 of 32 or more secret bytes the app obtains from the device:
//   a passkey's PRF value (extension) or a key held in the Android Keystore (app). `meta` is the app's own,
//   public data needed to obtain the secret again (for a passkey: its credential id and PRF salt).
// The ciphertext's associated data binds it to the record's version, method and address: a record whose
// address was changed does not open. After opening, the key must give back the record's address.
//
// The backup file holds one password record, for the client to keep away from the device:
//   { kind: "chainintegrate-up-key-backup", version: 1, created, name, key: <password record>,
//     account: { address, network } (optional) }
// `account` names the account the key controls, in clear (public data, outside the encrypted record): a restore
// finds the account from the file, without the service. It is not trusted for anything else.
// Kept in clear on purpose (audit U-05 suggested leaving it out): the record's own `address` must be in clear to
// open it, and that key's account can be found from it on the public network anyway; the file's protection is
// its password.
// A record of method "secret" is tied to the device and is never a backup.
(function (root, factory) {
  const api = factory(root.ethers || (typeof require === "function" ? require("ethers").ethers : null), root.crypto && root.crypto.subtle ? root.crypto : require("crypto").webcrypto);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UPKeystore = api;
})(typeof self !== "undefined" ? self : globalThis, function (ethers, webcrypto) {
  "use strict";
  const subtle = webcrypto.subtle;
  const VERSION = 1;
  const ROUNDS = 600000;
  const MIN_PASSWORD = 14, LONG_PASSWORD = 20;
  const HKDF_INFO = "up-onboarding key encryption v1";
  const BACKUP_KIND = "chainintegrate-up-key-backup";
  const enc = new TextEncoder();
  const b64 = (u8) => ethers.encodeBase64(u8);
  const unb64 = (s) => ethers.getBytes(ethers.decodeBase64(String(s)));
  const wipe = (u8) => { if (u8 && u8.fill) u8.fill(0); };
  const fail = (code, message) => Object.assign(new Error(message), { code });

  const aad = (method, address) => enc.encode(`up-onboarding/v${VERSION}/${method}/${address.toLowerCase()}`);

  async function aesFromPassword(password, salt, rounds) {
    const base = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function aesFromSecret(secret, salt, info) {
    const base = await subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
    return subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: enc.encode(info) }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  // null when the password is good enough for a new record, else "short" or "weak".
  function passwordProblem(password) {
    if (typeof password !== "string") return "short";
    const ch = [...password], n = ch.length;
    if (n < MIN_PASSWORD) return "short";
    const kinds = [/[a-zà-ÿ]/, /[A-ZÀ-Þ]/, /[0-9]/, /[^a-zA-Z0-9à-ÿÀ-Þ]/].filter((re) => re.test(password)).length;
    if (n < LONG_PASSWORD && kinds < 3) return "short";
    if (new Set(ch.map((c) => c.toLowerCase())).size < 8) return "weak";
    if (/(.)\1\1\1/u.test(password)) return "weak";
    const lower = password.toLowerCase();
    for (let i = 0; i + 6 <= lower.length; i++) {
      const s = lower.slice(i, i + 6);
      if (!/^[a-z0-9]+$/.test(s)) continue;
      const step = s.charCodeAt(1) - s.charCodeAt(0);
      if ((step === 1 || step === -1) && [...s].every((c, j) => j === 0 || c.charCodeAt(0) - s.charCodeAt(j - 1) === step)) return "weak";
    }
    for (let p = 1; p <= 6; p++) if (n % p === 0 && n / p >= 2 && ch.join("") === ch.slice(0, p).join("").repeat(n / p)) return "weak";
    return null;
  }
  function checkPassword(password) {
    const p = passwordProblem(password);
    if (p) throw fail("WEAK_PASSWORD", p === "short" ? `The password must have at least ${LONG_PASSWORD} characters, or ${MIN_PASSWORD} mixing upper and lower case, digits or symbols.` : "The password is too easy to guess (repeated characters or sequences).");
  }
  function checkSecret(secret) {
    if (!(secret instanceof Uint8Array) || secret.length < 32) throw fail("BAD_SECRET", "The device secret must be at least 32 bytes.");
  }
  const addressOf = (privateKey) => new ethers.Wallet(ethers.hexlify(privateKey)).address;

  // A new private key (32 bytes) and its address. The caller seals it and wipes it.
  function generate() {
    const w = ethers.Wallet.createRandom();
    return { address: w.address, privateKey: ethers.getBytes(w.privateKey) };
  }

  async function seal(privateKey, method, aes, extra) {
    const address = addressOf(privateKey);
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(method, address) }, aes, privateKey));
    return { v: VERSION, address, method, ...extra, iv: b64(iv), ct: b64(ct) };
  }
  async function sealWithPassword(privateKey, password, { rounds = ROUNDS } = {}) {
    checkPassword(password);
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    return seal(privateKey, "password", await aesFromPassword(password, salt, rounds), { kdf: { name: "PBKDF2-SHA256", rounds, salt: b64(salt) } });
  }
  async function sealWithSecret(privateKey, secret, meta = {}) {
    checkSecret(secret);
    const salt = webcrypto.getRandomValues(new Uint8Array(32));
    return seal(privateKey, "secret", await aesFromSecret(secret, salt, HKDF_INFO), { hkdf: { name: "HKDF-SHA256", salt: b64(salt), info: HKDF_INFO }, meta });
  }

  function checkRecord(r) {
    const ok = r && r.v === VERSION && ethers.isAddress(r.address) && typeof r.iv === "string" && typeof r.ct === "string" &&
      ((r.method === "password" && r.kdf && r.kdf.name === "PBKDF2-SHA256" && Number.isInteger(r.kdf.rounds) && r.kdf.rounds >= 100000 && r.kdf.rounds <= 10000000 && typeof r.kdf.salt === "string") ||
       (r.method === "secret" && r.hkdf && r.hkdf.name === "HKDF-SHA256" && r.hkdf.info === HKDF_INFO && typeof r.hkdf.salt === "string"));
    if (!ok) throw fail("BAD_RECORD", "Not a key record of this format.");
  }

  // The private key of a record; { password } or { secret }. Throws WRONG_SECRET when it does not open.
  async function open(record, { password, secret } = {}) {
    checkRecord(record);
    const aes = record.method === "password"
      ? await aesFromPassword(String(password == null ? "" : password), unb64(record.kdf.salt), record.kdf.rounds)
      : (checkSecret(secret), await aesFromSecret(secret, unb64(record.hkdf.salt), record.hkdf.info));
    let raw;
    try {
      raw = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: unb64(record.iv), additionalData: aad(record.method, record.address) }, aes, unb64(record.ct)));
    } catch (e) { throw fail("WRONG_SECRET", record.method === "password" ? "Wrong password." : "The device secret does not open this key."); }
    if (raw.length !== 32 || addressOf(raw) !== ethers.getAddress(record.address)) { wipe(raw); throw fail("MISMATCH", "The key does not match the record's address."); }
    return raw;
  }

  // Runs fn(signingKey) with the opened key, then wipes it. Returns what fn returns.
  async function withKey(record, unlock, fn) {
    const raw = await open(record, unlock);
    try { return await fn(new ethers.SigningKey(ethers.hexlify(raw))); } finally { wipe(raw); }
  }

  // The backup file of a password record; `name` is a label for the client ("Backup key, Rossi Srl").
  const NETWORKS = ["lukso", "lukso-testnet"];
  function checkAccount(a) {
    if (a == null) return null;
    if (typeof a !== "object" || !ethers.isAddress(a.address) || !NETWORKS.includes(a.network)) throw fail("BAD_BACKUP", "The account named in the backup is not valid.");
    return { address: ethers.getAddress(a.address), network: a.network };
  }
  function backupFile(record, { name = "", account = null } = {}) {
    checkRecord(record);
    if (record.method !== "password") throw fail("NOT_PORTABLE", "Only a password-protected key can be a backup.");
    const file = { kind: BACKUP_KIND, version: VERSION, created: new Date().toISOString(), name: String(name).slice(0, 64), key: record };
    const acc = checkAccount(account);
    if (acc) file.account = acc;
    return file;
  }
  // The record and the account the file names (null when it names none).
  function readBackupInfo(obj) { const record = readBackup(obj); return { record, account: checkAccount(obj.account) }; }
  function readBackup(obj) {
    if (!obj || obj.kind !== BACKUP_KIND || obj.version !== VERSION) throw fail("BAD_BACKUP", "Not a backup file of this format.");
    checkRecord(obj.key);
    if (obj.key.method !== "password") throw fail("BAD_BACKUP", "A backup must be protected by a password.");
    return obj.key;
  }

  return { VERSION, ROUNDS, MIN_PASSWORD, LONG_PASSWORD, passwordProblem, BACKUP_KIND, generate, sealWithPassword, sealWithSecret, open, withKey, backupFile, readBackup, readBackupInfo, wipe };
});
