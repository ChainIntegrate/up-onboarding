#!/usr/bin/env node
// The creation service: creates a client's account (a LUKSO Universal Profile) as soon as their extension asks,
// paying the gas with the service's own wallet, as LUKSO's relayer does for Universal Everything. Only with an
// invitation code from ChainIntegrate, and within the limits of the configuration.
//
//   node creator.js serve                       the HTTP service (behind nginx, at /api/)
//   node creator.js invite [--days 30] [--note "Rossi Srl"]   a new invitation code, printed once
//   node creator.js invites                     the codes: state, expiry, note, account created
//   node creator.js revoke <code>               a code that may no longer be used
//   node creator.js status                      the gas wallet's address and balance, today's count
//   node creator.js inspect <account>           the account's profile: its value on the network, the JSON and the
//                                               images on the IPFS node and on public gateways, their hashes
//   node creator.js withdraw <address> [amount]  sends the gas wallet's LYX (all of it, minus the fee, or the
//                                               amount) to an address of yours: the key never leaves the server
//   node creator.js backup                      a dated copy of the data folder in backupDir (the latest 30 kept);
//                                               every night by up-onboarding-backup.timer
//   node creator.js rebuild [--dry-run]         the list of created accounts (created.jsonl) rebuilt from the network:
//                                               the gas wallet's creations, read from LUKSO's explorer, each checked
//                                               on the network; adds the accounts missing from the list
// The configuration is ./config.json, or the file named by CREATOR_CONFIG (see config.example.json).
//
// POST /api/create  { invite, request, signature }
//   request:   the request of shared/request.js (profile, images, the client's keys);
//   signature: personal_sign of UPRequest.signingMessage(request) by one of its administrator keys, so an account
//              is only created for keys their owner holds.
// The service checks the code, the limits, the request and the signature; stores the images and the profile on
// IPFS (ChainIntegrate's node, shared/ipfs.js); sends the LSP23 call of shared/deploy.js with a random salt; waits for it; reads the account
// back (UPDeploy.verify); marks the code used. Answers { up, km, tx } or { error } with an HTTP status:
//   400 bad_request (with `problems`) or bad_signature, 403 invite_invalid, 409 invite_used, 410 invite_expired,
//   429 rate_limited or daily_limit, 503 unavailable (wallet too low, network unreachable), 502 failed.
// POST /api/lookup  { address }  ->  { up, network } of the account this service created with that key among
//   its keys, or 404 not_found. Used by the extension after restoring a backup on a new computer. The keys of a
//   profile are public on the network anyway; this only saves the extension from searching it.
// Codes are stored only as SHA-256 hashes; nothing about the client is logged but the account's address.
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { ethers } = require("ethers");
// The shared files take ethers from globalThis first: on the server ethers is installed in tools/creator only,
// and a require("ethers") from shared/ would not find it.
globalThis.ethers = ethers;
const UPRequest = require("../../shared/request.js");
const UPDeploy = require("../../shared/deploy.js");
const UPCatalog = require("../../shared/catalog.js");
const UPIpfs = require("../../shared/ipfs.js");
const UPRelay = require("../../shared/relay.js");

// ---------------------------------------------------------------- configuration
function loadConfig() {
  const file = process.env.CREATOR_CONFIG || path.join(__dirname, "config.json");
  const c = JSON.parse(fs.readFileSync(file, "utf8"));
  const base = path.dirname(file);
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(base, p));
  const need = ["network", "chainId", "gasKeyFile", "ipfsApi", "dataDir"];
  for (const k of need) if (c[k] === undefined) throw new Error(`config: ${k} is missing`);
  // The node: `rpcFile`, a file holding its URL when the URL carries an access key (ChainIntegrate's node:
  // https://rpc.chainintegrate.it/rpc/<key>), so the key is not in the configuration; else `rpc`.
  if (c.rpc === undefined && c.rpcFile === undefined) throw new Error("config: rpc or rpcFile is missing");
  const rpc = c.rpcFile ? fs.readFileSync(abs(c.rpcFile), "utf8").trim() : c.rpc;
  if (!/^https?:\/\//.test(rpc)) throw new Error("config: the node's URL must start with http(s)://");
  if (!UPRequest.NETWORKS.includes(c.network)) throw new Error("config: network must be lukso or lukso-testnet");
  return {
    network: c.network, rpc, rpcHost: new URL(rpc).host, chainId: Number(c.chainId),
    gasKeyFile: abs(c.gasKeyFile), dataDir: abs(c.dataDir),
    ipfsApi: c.ipfsApi, ipfsAuthFile: c.ipfsAuthFile ? abs(c.ipfsAuthFile) : null,
    host: c.host || "127.0.0.1", port: Number(c.port || 8811),
    maxPerDay: Number(c.maxPerDay ?? 20), perIpPerMinute: Number(c.perIpPerMinute ?? 1),
    maxControllers: Number(c.maxControllers ?? 5), inviteDays: Number(c.inviteDays ?? 30),
    minBalance: c.minBalance || "0.05", confirmSeconds: Number(c.confirmSeconds ?? 180),
    maxRelayPerDay: Number(c.maxRelayPerDay ?? 200), relayPerIpPerMinute: Number(c.relayPerIpPerMinute ?? 20),
    rpcPerIpPerMinute: Number(c.rpcPerIpPerMinute ?? 120),
    warmGateways: Array.isArray(c.warmGateways) ? c.warmGateways.map(String) : ["https://api.universalprofile.cloud/ipfs/"],
    backupDir: abs(c.backupDir || "/var/backups/up-onboarding"), backupKeep: Number(c.backupKeep ?? 30),
    explorerApi: String(c.explorerApi || (c.network === "lukso" ? "https://explorer.execution.mainnet.lukso.network/api/v2" : "https://explorer.execution.testnet.lukso.network/api/v2")).replace(/\/+$/, ""),
  };
}
const secret = (file) => fs.readFileSync(file, "utf8").trim();

// ---------------------------------------------------------------- invitation codes
// 12 characters from Crockford's base32 (no I, L, O, U), shown as XXXX-XXXX-XXXX; typing mistakes between
// O/0 and I/L/1 are forgiven. Only the SHA-256 of a code is stored.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function newCode() {
  const b = crypto.randomBytes(12);
  const s = [...b].map((x) => ALPHABET[x % 32]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
const normalize = (code) => String(code || "").toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
const hashCode = (code) => crypto.createHash("sha256").update(normalize(code)).digest("hex");

class Store {
  constructor(dir) { this.dir = dir; fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); this.file = path.join(dir, "invites.json"); }
  load() { try { return JSON.parse(fs.readFileSync(this.file, "utf8")); } catch (e) { if (e.code === "ENOENT") return {}; throw e; } }
  save(all) { const tmp = this.file + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(all, null, 1), { mode: 0o600 }); fs.renameSync(tmp, this.file); }
  update(hash, fields) { const all = this.load(); all[hash] = { ...all[hash], ...fields }; this.save(all); return all[hash]; }
  log(entry) { fs.appendFileSync(path.join(this.dir, "created.jsonl"), JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n", { mode: 0o600 }); }
  created() {
    try { return fs.readFileSync(path.join(this.dir, "created.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); }
    catch (e) { if (e.code === "ENOENT") return []; throw e; }
  }
  relayLog(entry) { fs.appendFileSync(path.join(this.dir, "relay.jsonl"), JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n", { mode: 0o600 }); }
  relayToday() {
    const day = new Date().toISOString().slice(0, 10);
    try { return fs.readFileSync(path.join(this.dir, "relay.jsonl"), "utf8").split("\n").filter((l) => l.includes(`"at":"${day}`)).length; }
    catch (e) { if (e.code === "ENOENT") return 0; throw e; }
  }
  usedToday() {
    const day = new Date().toISOString().slice(0, 10);
    return Object.values(this.load()).filter((i) => i.usedAt && i.usedAt.slice(0, 10) === day).length;
  }
}

// ---------------------------------------------------------------- IPFS
const pin = (cfg, bytes, filename, type) => UPIpfs.add(cfg.ipfsApi, bytes, { filename, type, auth: cfg.ipfsAuthFile ? secret(cfg.ipfsAuthFile) : "" });
const dataUrlBytes = (u) => ethers.getBytes(ethers.decodeBase64(u.slice(u.indexOf(",") + 1)));
const dataUrlType = (u) => u.slice(5, u.indexOf(";"));
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

// ---------------------------------------------------------------- the service
// The receipt of a transaction, asked every 1.5 seconds until it comes or the time is up (null then). Not ethers'
// waitForTransaction, which looks once and then waits for the next block: on a chain that makes blocks only for
// transactions (the tests) that block may never come.
async function waitReceipt(provider, hash, ms) {
  const until = Date.now() + ms;
  for (;;) {
    try { const rc = await provider.getTransactionReceipt(hash); if (rc && rc.blockNumber) return rc; } catch (e) { /* the RPC failed once: ask again */ }
    if (Date.now() > until) return null;
    await new Promise((r) => setTimeout(r, 1500));
  }
}

class HttpError extends Error { constructor(status, code, extra) { super(code); this.status = status; this.code = code; this.extra = extra || {}; } }

function makeService(cfg) {
  const store = new Store(cfg.dataDir);
  // A code left "creating" by a stop before any transaction is open again.
  { const all = store.load(); let n = 0; for (const k of Object.keys(all)) if (all[k].state === "creating" && !all[k].tx) { all[k].state = "open"; delete all[k].startedAt; n++; } if (n) store.save(all); }
  // cacheTimeout -1: ethers would otherwise answer identical RPC calls from a 250 ms cache, the gas wallet's
  // transaction count included, and two sends close together would reuse a nonce.
  const provider = new ethers.JsonRpcProvider(cfg.rpc, cfg.chainId, { staticNetwork: true, cacheTimeout: -1 });
  const wallet = new ethers.Wallet(secret(cfg.gasKeyFile), provider);
  const recent = new Map(); // ip -> [timestamps of the last minute]
  let queue = Promise.resolve(); // one creation at a time: one nonce sequence for the gas wallet

  function rateLimit(ip) {
    const now = Date.now();
    const list = (recent.get(ip) || []).filter((t) => now - t < 60000);
    if (list.length >= cfg.perIpPerMinute) throw new HttpError(429, "rate_limited");
    list.push(now); recent.set(ip, list);
  }
  // IP addresses are kept in memory for at most a minute (the privacy notice says so): forgotten every 30 seconds
  // once their last request is a minute old.
  const forget = setInterval(() => {
    const now = Date.now();
    for (const m of [recent, recentLookups, recentRelays]) for (const [k, v] of m) if (!v.some((t) => now - t < 60000)) m.delete(k);
  }, 30000);
  forget.unref();

  function checkInvite(code) {
    const hash = hashCode(code);
    const inv = normalize(code).length === 12 ? store.load()[hash] : null;
    if (!inv || inv.state === "revoked") throw new HttpError(403, "invite_invalid");
    if (inv.state !== "open") throw new HttpError(409, "invite_used");
    if (Date.parse(inv.expires) < Date.now()) throw new HttpError(410, "invite_expired");
    return hash;
  }

  function checkRequest(body) {
    const { request, errors } = UPRequest.parse(body.request);
    const problems = errors.slice();
    if (request && request.network !== cfg.network) problems.push("network");
    if (request && request.controllers.length > cfg.maxControllers) problems.push("controllers");
    if (problems.length) throw new HttpError(400, "bad_request", { problems });
    let signer;
    try { signer = ethers.verifyMessage(UPRequest.signingMessage(request), body.signature); } catch (e) { throw new HttpError(400, "bad_signature"); }
    if (!request.controllers.some((c) => c.role === "admin" && c.address === signer)) throw new HttpError(400, "bad_signature");
    return request;
  }

  // The images and the LSP3Profile JSON on IPFS: the profile value (VerifiableURI) and its URL.
  // One file asked from each public gateway in warmGateways until it answers (about a minute at most); never fatal.
  async function warm(ipfsUrl) {
    const cid = String(ipfsUrl).replace(/^ipfs:\/\//, "");
    for (const gw of cfg.warmGateways) {
      let ok = false;
      for (let i = 0; i < 4 && !ok; i++) {
        try { const r = await fetch(gw + cid, { signal: AbortSignal.timeout(15000) }); ok = r.ok; await r.arrayBuffer(); } catch (e) { ok = false; }
        if (!ok && i < 3) await new Promise((r) => setTimeout(r, 3000));
      }
      if (!ok) console.error(`warm: ${cid} not yet on ${new URL(gw).host}`);
    }
  }
  async function pinProfile(profile, imgs) {
    const images = {};
    for (const [kind, name] of [["avatar", "profile-image"], ["cover", "background-image"]]) {
      const im = imgs[kind];
      if (!im) continue;
      if (Array.isArray(im.entries)) { images[kind] = im.entries.length ? { entries: im.entries } : null; continue; }
      const bytes = dataUrlBytes(im.dataUrl), type = dataUrlType(im.dataUrl);
      images[kind] = { bytes, width: im.w, height: im.h, url: await pin(cfg, bytes, `${name}.${EXT[type]}`, type) };
    }
    const json = ethers.toUtf8Bytes(UPDeploy.lsp3Json(profile, images));
    const url = await pin(cfg, json, "LSP3Profile.json", "application/json");
    // Before the value is written on the account: the gateway of LUKSO's indexer (Universal Everything) asked for
    // the new files, so it has them when the change is seen. Content just added to ChainIntegrate's node takes a
    // while to be found by others, and the indexer does not retry: a profile it could not fetch stays "anonymous".
    const urls = [url, ...Object.values(images).filter((im) => im && im.url).map((im) => im.url)];
    await Promise.all(urls.map(warm));
    return { value: UPDeploy.profileValue(json, url), url };
  }

  async function create(request) {
    const { value } = await pinProfile(request.profile, request.images);
    const plan = UPDeploy.plan({ profileValue: value, controllers: request.controllers, salt: ethers.hexlify(crypto.randomBytes(32)) });
    const { up, km } = await UPDeploy.addresses(provider, plan);
    if ((await provider.getCode(up)) !== "0x") throw new HttpError(502, "failed", { reason: "exists" });
    // Gas: estimated, with a margin; refused when the wallet would drop under minBalance.
    const gas = await provider.estimateGas({ from: wallet.address, to: plan.to, data: plan.data });
    const fee = await provider.getFeeData();
    const price = fee.maxFeePerGas || fee.gasPrice;
    const balance = await provider.getBalance(wallet.address);
    if (balance < gas * price * 2n + ethers.parseEther(cfg.minBalance)) {
      console.error(`LOW BALANCE: ${ethers.formatEther(balance)} on ${wallet.address}`);
      throw new HttpError(503, "unavailable");
    }
    const tx = await wallet.sendTransaction({ to: plan.to, data: plan.data, gasLimit: (gas * 12n) / 10n });
    return { up, km, tx, plan };
  }

  async function handleCreate(body, ip) {
    rateLimit(ip);
    if (!body || typeof body.invite !== "string" || typeof body.signature !== "string") throw new HttpError(400, "bad_request", { problems: ["body"] });
    const hash = checkInvite(body.invite);
    const request = checkRequest(body);
    // Serial from here: the daily count, the code's state and the gas wallet's nonce.
    const run = queue.then(async () => {
      checkInvite(body.invite);
      if (store.usedToday() >= cfg.maxPerDay) { console.error("DAILY LIMIT reached"); throw new HttpError(429, "daily_limit"); }
      store.update(hash, { state: "creating", startedAt: new Date().toISOString() });
      let sent = null;
      try {
        sent = await create(request);
        store.update(hash, { state: "review", tx: sent.tx.hash, up: sent.up, usedAt: new Date().toISOString() });
        const rc = await waitReceipt(provider, sent.tx.hash, cfg.confirmSeconds * 1000);
        if (!rc || rc.status !== 1) throw new HttpError(502, "failed", { tx: sent.tx.hash });
        const problems = await UPDeploy.verify(provider, sent.plan, sent.up, sent.km, { blockTag: rc.blockNumber });
        if (problems.length) { store.log({ up: sent.up, tx: sent.tx.hash, problems }); throw new HttpError(502, "failed", { tx: sent.tx.hash }); }
        store.update(hash, { state: "used" });
        store.log({ up: sent.up, km: sent.km, tx: sent.tx.hash, network: cfg.network, keys: request.controllers.map((c) => c.address) });
        console.log(`created ${sent.up} (${cfg.network}) tx ${sent.tx.hash}`);
        return { up: sent.up, km: sent.km, tx: sent.tx.hash, network: cfg.network };
      } catch (e) {
        // Before a transaction, the code is open again; after one, it stays in "review" for the operator.
        if (!sent) store.update(hash, { state: "open", startedAt: undefined });
        if (e instanceof HttpError) throw e;
        console.error("create failed:", e.shortMessage || e.message);
        throw new HttpError(sent ? 502 : 503, sent ? "failed" : "unavailable", sent ? { tx: sent.tx.hash } : {});
      }
    });
    queue = run.catch(() => {});
    return run;
  }

  function handleLookup(body, ip) {
    rateLimitLookup(ip);
    if (!body || typeof body.address !== "string" || !ethers.isAddress(body.address)) throw new HttpError(400, "bad_request", { problems: ["address"] });
    const want = ethers.getAddress(body.address);
    const hit = store.created().reverse().find((e) => Array.isArray(e.keys) && e.keys.includes(want));
    if (!hit) throw new HttpError(404, "not_found");
    return { up: hit.up, network: hit.network };
  }
  const recentLookups = new Map();
  function rateLimitLookup(ip) {
    const now = Date.now();
    const list = (recentLookups.get(ip) || []).filter((t) => now - t < 60000);
    if (list.length >= 10) throw new HttpError(429, "rate_limited");
    list.push(now); recentLookups.set(ip, list);
  }

  // ---- operations on an account, gas paid by the service (LSP25 executeRelayCall; shared/relay.js)
  // Only accounts this service created; only what UPRelay.check allows (the profile, the signer's own name, the
  // calls in the projects' catalog, with its on-chain checks); simulated before sending, so a call the account's Key Manager or the target contract
  // would refuse costs nothing; a daily cap for the whole service, against a fault that repeats.
  const recentRelays = new Map();
  function rateLimitRelay(ip) {
    const now = Date.now();
    const list = (recentRelays.get(ip) || []).filter((t) => now - t < 60000);
    if (list.length >= cfg.relayPerIpPerMinute) throw new HttpError(429, "rate_limited");
    list.push(now); recentRelays.set(ip, list);
  }
  const UP_OWNER = new ethers.Interface(["function owner() view returns (address)"]);
  async function knownAccount(body) {
    if (!body || typeof body.account !== "string" || !ethers.isAddress(body.account)) throw new HttpError(400, "bad_request", { problems: ["account"] });
    const account = ethers.getAddress(body.account);
    if (!store.created().some((e) => e.up && ethers.getAddress(e.up) === account)) throw new HttpError(403, "unknown_account");
    const keyManager = UP_OWNER.decodeFunctionResult("owner", await provider.call({ to: account, data: UP_OWNER.encodeFunctionData("owner") }))[0];
    return { account, keyManager: ethers.getAddress(keyManager) };
  }

  async function handleRelayNonce(body, ip) {
    rateLimitRelay(ip);
    const { account, keyManager } = await knownAccount(body);
    if (typeof body.signer !== "string" || !ethers.isAddress(body.signer)) throw new HttpError(400, "bad_request", { problems: ["signer"] });
    const raw = await provider.call({ to: keyManager, data: UPRelay.KM.encodeFunctionData("getNonce", [ethers.getAddress(body.signer), 0]) });
    const nonce = UPRelay.KM.decodeFunctionResult("getNonce", raw)[0];
    // The network's time (the latest block's), for the validity of what the key signs: the Key Manager checks it
    // against the block's time, not against the client's clock.
    const latest = await provider.getBlock("latest");
    return { account, keyManager, nonce: nonce.toString(), chainId: cfg.chainId, time: latest ? Number(latest.timestamp) : Math.floor(Date.now() / 1000) };
  }

  // Why the account's Key Manager (LSP6, LSP25) or the account refused: its custom error by name, else the raw data.
  const KM_ERRORS = new ethers.Interface([
    "error NoPermissionsSet(address from)", "error NotAuthorised(address from, string permission)",
    "error NotAllowedCall(address from, address to, bytes4 selector)", "error NotAllowedERC725YDataKey(address from, bytes32 dataKey)",
    "error NoERC725YDataKeysAllowed(address from)", "error NoCallsAllowed(address from)",
    "error InvalidRelayNonce(address signer, uint256 invalidNonce, bytes signature)", "error RelayCallBeforeStartTime()", "error RelayCallExpired()",
    "error InvalidPayload(bytes payload)", "error InvalidERC725Function(bytes4 invalidFunction)", "error CannotSendValueToSetData()",
    "error InvalidLSP6Target()", "error LSP6BatchExcessiveValueSent(uint256 totalValues, uint256 msgValue)",
    "error ERC725Y_DataKeysValuesLengthMismatch()", "error ERC725Y_MsgValueDisallowed()", "error ERC725X_InsufficientBalance(uint256 balance, uint256 value)",
  ]);
  function refusal(e) {
    let data = e && (e.data || (e.info && e.info.error && e.info.error.data) || (e.error && e.error.data));
    if (data && typeof data === "object" && data.data) data = data.data;
    if (typeof data === "string" && /^0x[0-9a-fA-F]{8}/.test(data)) {
      try {
        const err = KM_ERRORS.parseError(data);
        if (err) return `${err.name}(${err.args.map((x) => (typeof x === "string" && x.length > 70 ? x.slice(0, 18) + "…" : String(x))).join(", ")})`.slice(0, 200);
      } catch (x) { /* not one of these */ }
      return `revert ${data.slice(0, 74)}`;
    }
    return String((e && (e.shortMessage || e.reason)) || "reverted").slice(0, 200);
  }
  const opName = (i) => (i.op === "project" ? `${i.project}:${i.fn.split("(")[0]}` : i.op);
  async function handleRelay(body, ip) {
    rateLimitRelay(ip);
    const { account, keyManager } = await knownAccount(body);
    let nonce, validity, payload, signature;
    try {
      nonce = BigInt(body.nonce); validity = BigInt(body.validity);
      payload = ethers.hexlify(body.payload); signature = ethers.Signature.from(body.signature).serialized;
    } catch (e) { throw new HttpError(400, "bad_request", { problems: ["fields"] }); }
    const { start, end } = UPRelay.splitValidity(validity);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (start > now + 60n || end <= now || end > now + 3600n) throw new HttpError(400, "bad_request", { problems: ["validity"] });
    const digest = UPRelay.digest({ chainId: cfg.chainId, keyManager, nonce, validity, value: 0n, payload });
    const signer = ethers.recoverAddress(digest, signature);
    const allowed = UPRelay.check(payload, { signer, chainId: cfg.chainId });
    if (!allowed.ok) throw new HttpError(400, "not_allowed", { reason: allowed.error });
    let isProject;
    try { isProject = await UPCatalog.verifyNeeds(provider, allowed.needs); } catch (e) { throw new HttpError(503, "unavailable"); }
    if (!isProject) throw new HttpError(400, "not_allowed", { reason: "not_a_project_contract" });
    const data = UPRelay.KM.encodeFunctionData("executeRelayCall", [signature, nonce, validity, payload]);
    // A validity that starts after the latest block (a client clock a little ahead; blocks come every ~12 s): wait,
    // within a minute and a half, for the network to reach it, else the Key Manager refuses it (RelayCallBeforeStartTime).
    if (start > 0n) {
      for (let i = 0; i < 30; i++) {
        const b = await provider.getBlock("latest");
        if (!b || BigInt(b.timestamp) >= start) break;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    const run = queue.then(async () => {
      if (store.relayToday() >= cfg.maxRelayPerDay) { console.error("RELAY DAILY LIMIT reached"); throw new HttpError(429, "daily_limit"); }
      // The Key Manager checks the signer's permissions and the nonce, the account checks the call: a refusal shows here.
      let gas;
      try { gas = await provider.estimateGas({ from: wallet.address, to: keyManager, data }); }
      catch (e) {
        const reason = refusal(e);
        console.error(`relay refused ${account} signer ${signer}: ${reason}`);
        throw new HttpError(422, "refused", { reason });
      }
      const fee = await provider.getFeeData();
      const balance = await provider.getBalance(wallet.address);
      if (balance < gas * (fee.maxFeePerGas || fee.gasPrice) * 2n + ethers.parseEther(cfg.minBalance)) {
        console.error(`LOW BALANCE: ${ethers.formatEther(balance)} on ${wallet.address}`);
        throw new HttpError(503, "unavailable");
      }
      const tx = await wallet.sendTransaction({ to: keyManager, data, gasLimit: (gas * 13n) / 10n });
      const rc = await waitReceipt(provider, tx.hash, cfg.confirmSeconds * 1000);
      const ok = !!rc && rc.status === 1;
      store.relayLog({ account, signer, ops: allowed.items.map(opName), tx: tx.hash, ok });
      console.log(`relay ${account} ${allowed.items.map(opName).join("+")} tx ${tx.hash} ${ok ? "ok" : "FAILED"}`);
      if (!ok) throw new HttpError(502, "failed", { tx: tx.hash });
      return { tx: tx.hash, ops: allowed.items };
    });
    queue = run.catch(() => {});
    return run;
  }

  // ---- reading the network for the extension (the projects' pages and the confirmation window): the extension is
  // public code and cannot hold the node's access key, so it reads through here. Only reading methods, one call per
  // request, small, limited per IP; nothing is logged.
  const RPC_READ = new Set(["eth_chainId", "eth_blockNumber", "eth_call", "eth_estimateGas", "eth_gasPrice", "eth_feeHistory", "eth_maxPriorityFeePerGas",
    "eth_getBalance", "eth_getCode", "eth_getStorageAt", "eth_getTransactionCount", "eth_getTransactionByHash", "eth_getTransactionReceipt",
    "eth_getBlockByNumber", "eth_getBlockByHash", "eth_getLogs"]);
  const MAX_LOG_BLOCKS = 100000n;
  const recentRpc = new Map();
  function logsFilterOk(f) {
    if (!f || typeof f !== "object" || !f.address) return false;
    if (f.blockHash) return f.fromBlock === undefined && f.toBlock === undefined;
    try { const a = BigInt(f.fromBlock), b = BigInt(f.toBlock); return a <= b && b - a <= MAX_LOG_BLOCKS; } catch (e) { return false; }
  }
  async function handleRpc(body, ip) {
    const now = Date.now();
    const list = (recentRpc.get(ip) || []).filter((t) => now - t < 60000);
    if (list.length >= cfg.rpcPerIpPerMinute) throw new HttpError(429, "rate_limited");
    list.push(now); recentRpc.set(ip, list);
    const id = body && (typeof body.id === "number" || typeof body.id === "string") ? body.id : 1;
    if (!body || typeof body !== "object" || Array.isArray(body) || !RPC_READ.has(body.method) || !Array.isArray(body.params || []) || JSON.stringify(body).length > 16384)
      throw new HttpError(400, "not_allowed", { reason: "rpc_method" });
    const params = body.params || [];
    if (body.method === "eth_getLogs" && !logsFilterOk(params[0])) throw new HttpError(400, "not_allowed", { reason: "rpc_logs_range" });
    let b;
    try {
      const r = await fetch(cfg.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: body.method, params }), signal: AbortSignal.timeout(15000) });
      b = await r.json();
    } catch (e) { throw new HttpError(502, "upstream"); }
    if (b && b.error) return { jsonrpc: "2.0", id, error: { code: Number.isInteger(b.error.code) ? b.error.code : -32603, message: String(b.error.message || "error").slice(0, 300), ...(b.error.data !== undefined ? { data: b.error.data } : {}) } };
    if (!b || !("result" in b)) throw new HttpError(502, "upstream");
    return { jsonrpc: "2.0", id, result: b.result };
  }
  setInterval(() => { const now = Date.now(); for (const [ip, l] of recentRpc) if (!l.some((t) => now - t < 60000)) recentRpc.delete(ip); }, 30000).unref();

  // A new profile on IPFS for an existing account, asked by one of its keys; the extension then writes its value
  // with the relay. Counted with the relay's operations (daily cap).
  const UP_GETDATA = new ethers.Interface(["function getData(bytes32) view returns (bytes)"]);
  // The current profile's picture entries, read from the account and the IPFS node, checked against the hash written
  // on the account: [] when there is none or it cannot be read.
  // The account's current profile (LSP3Profile), read from the account and the IPFS node and checked against the hash
  // written on the account: the JSON's LSP3Profile object, or null when there is none or it cannot be read.
  async function currentProfile(account) {
    try {
      const value = UP_GETDATA.decodeFunctionResult("getData", await provider.call({ to: account, data: UP_GETDATA.encodeFunctionData("getData", [UPDeploy.LSP3_KEY]) }))[0];
      const b = ethers.getBytes(value);
      if (b.length < 40 || ethers.hexlify(b.slice(0, 8)) !== "0x00006f357c6a0020") return null;
      const hash = ethers.hexlify(b.slice(8, 40)), cid = ethers.toUtf8String(b.slice(40)).replace(/^ipfs:\/\//, "");
      const res = await fetch(cfg.ipfsApi.replace(/\/+$/, "") + "/api/v0/cat?arg=" + encodeURIComponent(cid), { method: "POST", headers: cfg.ipfsAuthFile ? { Authorization: secret(cfg.ipfsAuthFile) } : {}, signal: AbortSignal.timeout(20000) });
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!res.ok || ethers.keccak256(bytes) !== hash) return null;
      const p = JSON.parse(ethers.toUtf8String(bytes)).LSP3Profile;
      return p && typeof p === "object" ? p : null;
    } catch (e) { return null; }
  }
  // Its picture entries (ipfs:// only): [] when none.
  async function currentPictures(account) {
    const p = await currentProfile(account);
    const list = p && p.profileImage;
    return Array.isArray(list) ? list.slice(0, 4).filter((e) => e && typeof e.url === "string" && /^ipfs:\/\//.test(e.url)) : [];
  }

  // What the extension shows of the account after a restore from the backup (it kept nothing else): the profile's
  // name, description and picture, and the signer's name on the account. All public on the network already.
  async function handleProfileRead(body, ip) {
    rateLimitRelay(ip);
    const { account } = await knownAccount(body);
    const p = (await currentProfile(account)) || {};
    const pics = Array.isArray(p.profileImage) ? p.profileImage.filter((e) => e && typeof e.url === "string" && /^ipfs:\/\/[a-zA-Z0-9]{46,100}$/.test(e.url)) : [];
    pics.sort((a, b) => Math.abs((a.width || 0) - 256) - Math.abs((b.width || 0) - 256));
    let deviceName = null;
    if (typeof body.signer === "string" && ethers.isAddress(body.signer)) {
      try {
        const v = UP_GETDATA.decodeFunctionResult("getData", await provider.call({ to: account, data: UP_GETDATA.encodeFunctionData("getData", [UPRelay.nameKey(ethers.getAddress(body.signer))]) }))[0];
        deviceName = v && v !== "0x" ? ethers.toUtf8String(v).slice(0, 64) : null;
      } catch (e) { deviceName = null; }
    }
    const text = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
    return { account, name: text(p.name, 64), description: text(p.description, 1000), picture: pics.length ? pics[0].url : null, deviceName };
  }


  async function handleProfile(body, ip) {
    rateLimitRelay(ip);
    const { update, errors } = UPRequest.profileUpdate((body && body.update) || {});
    if (errors.length) throw new HttpError(400, "bad_request", { problems: errors });
    const { account } = await knownAccount({ account: update.account });
    let signer;
    try { signer = ethers.verifyMessage(UPRequest.updateMessage(update), body.signature); } catch (e) { throw new HttpError(400, "bad_signature"); }
    const permKey = "0x4b80742de2bf82acb3630000" + signer.slice(2).toLowerCase();
    const perms = UP_GETDATA.decodeFunctionResult("getData", await provider.call({ to: account, data: UP_GETDATA.encodeFunctionData("getData", [permKey]) }))[0];
    if (!perms || perms === "0x" || BigInt(perms) === 0n) throw new HttpError(400, "bad_signature");
    if (store.relayToday() >= cfg.maxRelayPerDay) throw new HttpError(429, "daily_limit");
    let images = update.images;
    if (update.keepPicture) images = { avatar: { entries: await currentPictures(account) }, cover: null };
    let pinned;
    try { pinned = await pinProfile(update.profile, images); }
    catch (e) { console.error("profile pin failed:", e.message); throw new HttpError(503, "unavailable"); }
    store.relayLog({ account, signer, ops: ["pin"], url: pinned.url, ok: true });
    return { value: pinned.value, url: pinned.url };
  }

  return { handleCreate, handleLookup, handleRelayNonce, handleRelay, handleProfile, handleProfileRead, handleRpc, wallet, provider, store };
}

// The extension's latest *released* version (web/extension/latest.txt, updated right after each release, so a
// version still in development on main is never offered), and where to download it: the extension compares it
// with its own and offers the update.
const EXTENSION_DOWNLOAD = "https://github.com/ChainIntegrate/up-onboarding/releases/latest/download/chainintegrate-account.zip"; // the same link as the client page's "Install"
function latestExtension() {
  try {
    const version = fs.readFileSync(path.join(__dirname, "..", "..", "web", "extension", "latest.txt"), "utf8").trim();
    return /^\d+\.\d+\.\d+$/.test(version) ? { version, download: EXTENSION_DOWNLOAD } : null;
  }
  catch (e) { return null; }
}

function serve(cfg) {
  const svc = makeService(cfg);
  const server = http.createServer((req, res) => {
    const send = (status, obj) => { res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && url.pathname === "/api/health") return send(200, { ok: true, network: cfg.network, extension: latestExtension() });
    const ROUTES = ["/api/create", "/api/lookup", "/api/relay/nonce", "/api/relay", "/api/profile", "/api/profile/read", "/api/rpc"];
    if (req.method !== "POST" || !ROUTES.includes(url.pathname)) return send(404, { error: "not_found" });
    // nginx sets X-Real-IP; the service listens on localhost only, so the header comes from nginx.
    const ip = String(req.headers["x-real-ip"] || req.socket.remoteAddress);
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 6 * 1024 * 1024) { send(413, { error: "too_large" }); req.destroy(); } else chunks.push(c); });
    req.on("end", async () => {
      if (res.writableEnded) return;
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) { return send(400, { error: "bad_request", problems: ["json"] }); }
      try {
        const handler = { "/api/create": svc.handleCreate, "/api/lookup": svc.handleLookup, "/api/relay/nonce": svc.handleRelayNonce, "/api/relay": svc.handleRelay, "/api/profile": svc.handleProfile, "/api/profile/read": svc.handleProfileRead, "/api/rpc": svc.handleRpc }[url.pathname];
        send(200, await handler(body, ip));
      }
      catch (e) { if (e instanceof HttpError) send(e.status, { error: e.code, ...e.extra }); else { console.error(e); send(500, { error: "internal" }); } }
    });
  });
  server.listen(cfg.port, cfg.host, () => console.log(`creator: ${cfg.network}, gas wallet ${svc.wallet.address}, http://${cfg.host}:${cfg.port}/api/`));
  return server;
}

// ---------------------------------------------------------------- command line
async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (name, def) => { const i = rest.indexOf("--" + name); return i >= 0 ? rest[i + 1] : def; };
  const cfg = loadConfig();
  const store = new Store(cfg.dataDir);
  if (cmd === "serve") return serve(cfg);
  if (cmd === "invite") {
    const days = Number(opt("days", cfg.inviteDays));
    const code = newCode();
    const expires = new Date(Date.now() + days * 86400000).toISOString();
    store.update(hashCode(code), { state: "open", created: new Date().toISOString(), expires, note: String(opt("note", "")).slice(0, 80), id: crypto.randomBytes(3).toString("hex") });
    console.log(code);
    console.error(`valid until ${expires.slice(0, 10)}`);
    return;
  }
  if (cmd === "invites") {
    for (const i of Object.values(store.load()).sort((a, b) => a.created.localeCompare(b.created))) {
      const st = i.state === "open" && Date.parse(i.expires) < Date.now() ? "expired" : i.state;
      console.log([i.id, st.padEnd(8), i.created.slice(0, 10), "until " + i.expires.slice(0, 10), i.up || "", i.note || ""].join("  "));
    }
    return;
  }
  if (cmd === "revoke") {
    const all = store.load(); const h = hashCode(rest[0]);
    const byId = Object.keys(all).find((k) => all[k].id === rest[0]);
    const key = all[h] ? h : byId;
    if (!key) { console.error("unknown code"); process.exit(1); }
    if (all[key].state !== "open") { console.error(`not open: ${all[key].state}`); process.exit(1); }
    store.update(key, { state: "revoked" }); console.log("revoked"); return;
  }
  if (cmd === "status") {
    const provider = new ethers.JsonRpcProvider(cfg.rpc, cfg.chainId, { staticNetwork: true, cacheTimeout: -1 });
    const w = new ethers.Wallet(secret(cfg.gasKeyFile));
    console.log(`network ${cfg.network}\ngas wallet ${w.address}\nbalance ${ethers.formatEther(await provider.getBalance(w.address))}\ncreated today ${store.usedToday()} of ${cfg.maxPerDay}\nrelayed today ${store.relayToday()} of ${cfg.maxRelayPerDay}`);
    return;
  }
  if (cmd === "inspect") {
    const up = rest[0];
    if (!up || !ethers.isAddress(up)) { console.error("usage: creator.js inspect <account address>"); process.exit(2); }
    const provider = new ethers.JsonRpcProvider(cfg.rpc, cfg.chainId, { staticNetwork: true, cacheTimeout: -1 });
    const c = new ethers.Contract(up, ["function getData(bytes32) view returns (bytes)"], provider);
    const value = await c.getData(UPDeploy.LSP3_KEY);
    console.log(`network ${cfg.network}\naccount ${ethers.getAddress(up)}\ncode ${(await provider.getCode(up)) !== "0x" ? "yes" : "NO CODE"}`);
    if (!value || value === "0x") { console.log("LSP3Profile: EMPTY"); return; }
    const method = ethers.dataSlice(value, 2, 6), len = parseInt(ethers.dataSlice(value, 6, 8), 16);
    const hash = ethers.dataSlice(value, 8, 8 + len), url = ethers.toUtf8String(ethers.dataSlice(value, 8 + len));
    console.log(`LSP3Profile: ${ethers.dataLength(value)} bytes, method ${method} ${method === "0x6f357c6a" ? "(keccak256 utf8, ok)" : "(UNEXPECTED)"}\nhash ${hash}\nurl ${url}`);
    const cid = url.replace(/^ipfs:\/\//, "");
    // Sources: the node's own API (what the service wrote), its public gateway, LUKSO's (what Universal Everything uses), ipfs.io.
    const sources = [
      ["node API", () => fetch(cfg.ipfsApi.replace(/\/+$/, "") + "/api/v0/cat?arg=" + encodeURIComponent(cid), { method: "POST", signal: AbortSignal.timeout(20000) })],
      ["ipfs.chainintegrate.it", () => fetch("https://ipfs.chainintegrate.it/ipfs/" + cid, { signal: AbortSignal.timeout(30000) })],
      ["api.universalprofile.cloud (LUKSO, Universal Everything)", () => fetch("https://api.universalprofile.cloud/ipfs/" + cid, { signal: AbortSignal.timeout(30000) })],
      ["ipfs.io", () => fetch("https://ipfs.io/ipfs/" + cid, { signal: AbortSignal.timeout(30000) })],
    ];
    let json = null;
    for (const [name, get] of sources) {
      try {
        const r = await get();
        const bytes = new Uint8Array(await r.arrayBuffer());
        const ok = r.ok && ethers.keccak256(bytes) === hash;
        console.log(`  ${ok ? "OK  " : "FAIL"} ${name}: HTTP ${r.status}, ${bytes.length} bytes${r.ok && !ok ? ", hash differs" : ""}`);
        if (ok && !json) json = JSON.parse(ethers.toUtf8String(bytes));
      } catch (e) { console.log(`  FAIL ${name}: ${e.name === "TimeoutError" ? "timeout" : e.message}`); }
    }
    // LUKSO's profile index (Envio), which Universal Everything reads: has it indexed this account, with which name?
    const index = cfg.network === "lukso" ? "https://envio.lukso-mainnet.universal.tech/v1/graphql" : "https://envio.lukso-testnet.universal.tech/v1/graphql";
    const gql = async (query, variables) => {
      const r = await fetch(index, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(20000) });
      return r.json();
    };
    try {
      const byId = await gql("query($id: String!) { Profile(where: { id: { _eq: $id } }) { id name fullName } }", { id: ethers.getAddress(up).toLowerCase() });
      console.log(`index ${index}\n  by address: ${JSON.stringify(byId.data ? byId.data.Profile : byId.errors && byId.errors[0] && byId.errors[0].message)}`);
      if (json && json.LSP3Profile && json.LSP3Profile.name) {
        const byName = await gql("query($search: String!) { search_profiles(args: { search: $search }, limit: 8) { id name fullName } }", { search: json.LSP3Profile.name });
        const list = byName.data ? byName.data.search_profiles : null;
        console.log(`  by name "${json.LSP3Profile.name}": ${list ? (list.some((x) => String(x.id).toLowerCase() === up.toLowerCase()) ? "found" : `not found (${list.length} other result(s))`) : JSON.stringify(byName.errors && byName.errors[0] && byName.errors[0].message)}`);
      }
    } catch (e) { console.log(`index ${index}: ${e.name === "TimeoutError" ? "timeout" : e.message}`); }
    if (!json) { console.log("the JSON could not be read with its hash anywhere"); return; }
    const p = json.LSP3Profile || {};
    console.log(`JSON: name "${p.name}", ${(p.profileImage || []).length} profile image(s), ${(p.backgroundImage || []).length} cover(s), ${(p.links || []).length} link(s)`);
    for (const im of [...(p.profileImage || []), ...(p.backgroundImage || [])]) {
      const icid = String(im.url).replace(/^ipfs:\/\//, "");
      console.log(`image ${im.url} (${im.width}x${im.height})`);
      for (const [name, base] of [["ipfs.chainintegrate.it", "https://ipfs.chainintegrate.it/ipfs/"], ["api.universalprofile.cloud", "https://api.universalprofile.cloud/ipfs/"]]) {
        try {
          const r = await fetch(base + icid, { signal: AbortSignal.timeout(30000) });
          const bytes = new Uint8Array(await r.arrayBuffer());
          const ok = r.ok && im.verification && ethers.keccak256(bytes) === im.verification.data;
          console.log(`  ${ok ? "OK  " : "FAIL"} ${name}: HTTP ${r.status}, ${bytes.length} bytes`);
        } catch (e) { console.log(`  FAIL ${name}: ${e.name === "TimeoutError" ? "timeout" : e.message}`); }
      }
    }
    return;
  }
  if (cmd === "withdraw") {
    const to = rest[0];
    if (!to || !ethers.isAddress(to)) { console.error("usage: creator.js withdraw <address> [amount]"); process.exit(2); }
    const provider = new ethers.JsonRpcProvider(cfg.rpc, cfg.chainId, { staticNetwork: true, cacheTimeout: -1 });
    const w = new ethers.Wallet(secret(cfg.gasKeyFile), provider);
    if ((await provider.getCode(to)) !== "0x" && !rest.includes("--contract")) { console.error("the address is a contract (a profile?): add --contract if that is what you want"); process.exit(1); }
    const balance = await provider.getBalance(w.address);
    const fee = await provider.getFeeData();
    const all = !(rest[1] && rest[1] !== "--contract");
    // Everything: a fixed gas price (a legacy transaction), so the fee is exactly gasLimit × price and nothing is left
    // (with EIP-1559 the network charges less than the maximum and the difference would stay in the wallet).
    const price = all ? fee.gasPrice : (fee.maxFeePerGas || fee.gasPrice);
    const gasLimit = (await provider.getCode(to)) === "0x" ? 21000n : 100000n;
    const amount = all ? balance - gasLimit * price : ethers.parseEther(rest[1]);
    if (amount <= 0n || amount + gasLimit * price > balance) { console.error(`not enough: balance ${ethers.formatEther(balance)}`); process.exit(1); }
    const tx = await w.sendTransaction(all
      ? { to: ethers.getAddress(to), value: amount, gasLimit, gasPrice: price, type: 0 }
      : { to: ethers.getAddress(to), value: amount, gasLimit, maxFeePerGas: fee.maxFeePerGas || undefined, maxPriorityFeePerGas: fee.maxPriorityFeePerGas || undefined, gasPrice: fee.maxFeePerGas ? undefined : fee.gasPrice });
    console.log(`sent ${ethers.formatEther(amount)} to ${ethers.getAddress(to)}: ${tx.hash}`);
    if (!(await waitReceipt(provider, tx.hash, cfg.confirmSeconds * 1000))) { console.error("not confirmed yet: check it later"); process.exit(1); }
    console.log(`confirmed; balance now ${ethers.formatEther(await provider.getBalance(w.address))}`);
    return;
  }
  if (cmd === "backup") {
    fs.mkdirSync(cfg.backupDir, { recursive: true, mode: 0o700 });
    const out = path.join(cfg.backupDir, `up-onboarding-${new Date().toISOString().slice(0, 10)}.tar.gz`);
    const tmp = out + ".tmp";
    require("child_process").execFileSync("tar", ["-czf", tmp, "--exclude=./alert-state.json", "--exclude=*.tmp", "-C", cfg.dataDir, "."]);
    fs.chmodSync(tmp, 0o600); fs.renameSync(tmp, out);
    const all = fs.readdirSync(cfg.backupDir).filter((f) => /^up-onboarding-\d{4}-\d{2}-\d{2}\.tar\.gz$/.test(f)).sort();
    for (const f of all.slice(0, Math.max(0, all.length - cfg.backupKeep))) fs.unlinkSync(path.join(cfg.backupDir, f));
    console.log(`backup ${out} (${fs.statSync(out).size} bytes); ${Math.min(all.length, cfg.backupKeep)} copies kept in ${cfg.backupDir}`);
    return;
  }
  if (cmd === "rebuild") {
    const dry = rest.includes("--dry-run");
    const provider = new ethers.JsonRpcProvider(cfg.rpc, cfg.chainId, { staticNetwork: true, cacheTimeout: -1 });
    const gas = new ethers.Wallet(secret(cfg.gasKeyFile)).address;
    const known = new Set(store.created().filter((e) => e.up).map((e) => ethers.getAddress(e.up)));
    // The gas wallet's transactions, from LUKSO's explorer (Blockscout API): the node cannot list them.
    const hashes = [];
    let next = "";
    for (let page = 0; page < 500; page++) {
      const res = await fetch(`${cfg.explorerApi}/addresses/${gas}/transactions?filter=from${next}`, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`the explorer answers ${res.status}`);
      const b = await res.json();
      for (const it of b.items || []) if (it && it.to && it.to.hash && ethers.getAddress(it.to.hash) === UPDeploy.FACTORY && it.status === "ok") hashes.push(it.hash);
      if (!b.next_page_params) break;
      next = "&" + new URLSearchParams(b.next_page_params).toString();
    }
    // A creation read back from its transaction's data: the call's arguments and the client's keys (the
    // AddressPermissions[] items but LUKSO's LSP1 delegate), as shared/deploy.js writes them.
    const FACTORY_IFACE = new ethers.Interface(["function deployERC1167Proxies((bytes32 salt,uint256 fundingAmount,address implementationContract,bytes initializationCalldata) primary,(uint256 fundingAmount,address implementationContract,bytes initializationCalldata,bool addPrimaryContractAddress,bytes extraInitializationParams) secondary,address postDeploymentModule,bytes postDeploymentModuleCalldata) payable returns (address,address)"]);
    const ARRAY_KEY = "0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3";
    const readCreation = (data) => {
      let t;
      try { t = FACTORY_IFACE.parseTransaction({ data }); } catch (e) { return null; }
      if (!t || ethers.getAddress(t.args[2]) !== ethers.getAddress(UPDeploy.POST_MODULE)) return null;
      let keys, values;
      try { [keys, values] = ethers.AbiCoder.defaultAbiCoder().decode(["bytes32[]", "bytes[]"], t.args[3]); } catch (e) { return null; }
      const controllers = [];
      keys.forEach((k, i) => {
        if (k.toLowerCase().startsWith(ARRAY_KEY.slice(0, 34)) && k.toLowerCase() !== ARRAY_KEY) {
          try { const a = ethers.getAddress(ethers.dataSlice(values[i], 0, 20)); if (a !== ethers.getAddress(UPDeploy.URD)) controllers.push(a); } catch (e) { /* not an address */ }
        }
      });
      return { args: [[...t.args[0]], [...t.args[1]], t.args[2], t.args[3]], controllers };
    };
    const UPI = new ethers.Interface(["function owner() view returns (address)"]);
    const KMI = new ethers.Interface(["function target() view returns (address)"]);
    const factory = new ethers.Contract(UPDeploy.FACTORY, ["function computeERC1167Addresses((bytes32,uint256,address,bytes),(uint256,address,bytes,bool,bytes),address,bytes) view returns (address,address)"], provider);
    let added = 0;
    for (const h of hashes.reverse()) {
      const tx = await provider.getTransaction(h);
      const rc = await provider.getTransactionReceipt(h);
      const c = tx && rc && rc.status === 1 && ethers.getAddress(tx.from) === gas ? readCreation(tx.data) : null;
      if (!c) { console.log(`${h}: not a creation, skipped`); continue; }
      const [upA, kmA] = await factory.computeERC1167Addresses(...c.args);
      const up = ethers.getAddress(upA), km = ethers.getAddress(kmA);
      const owner = UPI.decodeFunctionResult("owner", await provider.call({ to: up, data: UPI.encodeFunctionData("owner") }))[0];
      const target = KMI.decodeFunctionResult("target", await provider.call({ to: km, data: KMI.encodeFunctionData("target") }))[0];
      if (ethers.getAddress(owner) !== km || ethers.getAddress(target) !== up) { console.log(`${h}: account ${up} not as created (owner ${owner}), skipped`); continue; }
      if (known.has(up)) { console.log(`${up}: already in the list`); continue; }
      const block = await provider.getBlock(rc.blockNumber);
      const entry = { at: new Date(Number(block.timestamp) * 1000).toISOString(), up, km, tx: h, network: cfg.network, keys: c.controllers, rebuilt: true };
      console.log(`${up}: missing, ${dry ? "would be added" : "added"} (tx ${h}, keys ${c.controllers.join(" ")})`);
      if (!dry) fs.appendFileSync(path.join(cfg.dataDir, "created.jsonl"), JSON.stringify(entry) + "\n", { mode: 0o600 });
      known.add(up); added++;
    }
    console.log(`${hashes.length} creation(s) found by the explorer, ${added} account(s) ${dry ? "missing" : "added"}`);
    return;
  }
  console.error("usage: creator.js serve | invite [--days N] [--note TEXT] | invites | revoke <code or id> | status | inspect <account> | withdraw <address> [amount] | backup | rebuild [--dry-run]");
  process.exit(2);
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { makeService, serve, loadConfig, newCode, normalize, hashCode };
