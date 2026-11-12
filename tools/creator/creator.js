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
//   node creator.js withdraw <address> [amount]  sends the gas wallet's LYX (all of it, minus the fee, or the
//                                               amount) to an address of yours: the key never leaves the server
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
const UPIpfs = require("../../shared/ipfs.js");

// ---------------------------------------------------------------- configuration
function loadConfig() {
  const file = process.env.CREATOR_CONFIG || path.join(__dirname, "config.json");
  const c = JSON.parse(fs.readFileSync(file, "utf8"));
  const base = path.dirname(file);
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(base, p));
  const need = ["network", "rpc", "chainId", "gasKeyFile", "ipfsApi", "dataDir"];
  for (const k of need) if (c[k] === undefined) throw new Error(`config: ${k} is missing`);
  if (!UPRequest.NETWORKS.includes(c.network)) throw new Error("config: network must be lukso or lukso-testnet");
  return {
    network: c.network, rpc: c.rpc, chainId: Number(c.chainId),
    gasKeyFile: abs(c.gasKeyFile), dataDir: abs(c.dataDir),
    ipfsApi: c.ipfsApi, ipfsAuthFile: c.ipfsAuthFile ? abs(c.ipfsAuthFile) : null,
    host: c.host || "127.0.0.1", port: Number(c.port || 8811),
    maxPerDay: Number(c.maxPerDay ?? 20), perIpPerMinute: Number(c.perIpPerMinute ?? 1),
    maxControllers: Number(c.maxControllers ?? 5), inviteDays: Number(c.inviteDays ?? 30),
    minBalance: c.minBalance || "0.05", confirmSeconds: Number(c.confirmSeconds ?? 180),
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
class HttpError extends Error { constructor(status, code, extra) { super(code); this.status = status; this.code = code; this.extra = extra || {}; } }

function makeService(cfg) {
  const store = new Store(cfg.dataDir);
  // A code left "creating" by a stop before any transaction is open again.
  { const all = store.load(); let n = 0; for (const k of Object.keys(all)) if (all[k].state === "creating" && !all[k].tx) { all[k].state = "open"; delete all[k].startedAt; n++; } if (n) store.save(all); }
  const provider = new ethers.JsonRpcProvider(cfg.rpc, cfg.chainId, { staticNetwork: true });
  const wallet = new ethers.Wallet(secret(cfg.gasKeyFile), provider);
  const recent = new Map(); // ip -> [timestamps of the last minute]
  let queue = Promise.resolve(); // one creation at a time: one nonce sequence for the gas wallet

  function rateLimit(ip) {
    const now = Date.now();
    const list = (recent.get(ip) || []).filter((t) => now - t < 60000);
    if (list.length >= cfg.perIpPerMinute) throw new HttpError(429, "rate_limited");
    list.push(now); recent.set(ip, list);
    if (recent.size > 10000) for (const [k, v] of recent) if (!v.some((t) => now - t < 60000)) recent.delete(k);
  }

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

  async function create(request) {
    // Images and profile on IPFS.
    const images = {};
    for (const [kind, name] of [["avatar", "profile-image"], ["cover", "background-image"]]) {
      const im = request.images[kind];
      if (!im) continue;
      const bytes = dataUrlBytes(im.dataUrl), type = dataUrlType(im.dataUrl);
      images[kind] = { bytes, width: im.w, height: im.h, url: await pin(cfg, bytes, `${name}.${EXT[type]}`, type) };
    }
    const json = ethers.toUtf8Bytes(UPDeploy.lsp3Json(request.profile, images));
    const url = await pin(cfg, json, "LSP3Profile.json", "application/json");
    const plan = UPDeploy.plan({ profileValue: UPDeploy.profileValue(json, url), controllers: request.controllers, salt: ethers.hexlify(crypto.randomBytes(32)) });
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
        const rc = await provider.waitForTransaction(sent.tx.hash, 1, cfg.confirmSeconds * 1000);
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
    if (recentLookups.size > 10000) recentLookups.clear();
  }

  return { handleCreate, handleLookup, wallet, provider, store };
}

// The extension's latest version, as in this clone (git pull brings it), and where to download it: the extension
// compares it with its own and offers the update.
const EXTENSION_DOWNLOAD = "https://github.com/ChainIntegrate/up-onboarding/releases/latest";
function latestExtension() {
  try { return { version: JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "extension", "manifest.json"), "utf8")).version, download: EXTENSION_DOWNLOAD }; }
  catch (e) { return null; }
}

function serve(cfg) {
  const svc = makeService(cfg);
  const server = http.createServer((req, res) => {
    const send = (status, obj) => { res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && url.pathname === "/api/health") return send(200, { ok: true, network: cfg.network, extension: latestExtension() });
    if (req.method !== "POST" || (url.pathname !== "/api/create" && url.pathname !== "/api/lookup")) return send(404, { error: "not_found" });
    // nginx sets X-Real-IP; the service listens on localhost only, so the header comes from nginx.
    const ip = String(req.headers["x-real-ip"] || req.socket.remoteAddress);
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 6 * 1024 * 1024) { send(413, { error: "too_large" }); req.destroy(); } else chunks.push(c); });
    req.on("end", async () => {
      if (res.writableEnded) return;
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) { return send(400, { error: "bad_request", problems: ["json"] }); }
      try { send(200, url.pathname === "/api/lookup" ? svc.handleLookup(body, ip) : await svc.handleCreate(body, ip)); }
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
    const provider = new ethers.JsonRpcProvider(cfg.rpc, cfg.chainId, { staticNetwork: true });
    const w = new ethers.Wallet(secret(cfg.gasKeyFile));
    console.log(`network ${cfg.network}\ngas wallet ${w.address}\nbalance ${ethers.formatEther(await provider.getBalance(w.address))}\ncreated today ${store.usedToday()} of ${cfg.maxPerDay}`);
    return;
  }
  if (cmd === "withdraw") {
    const to = rest[0];
    if (!to || !ethers.isAddress(to)) { console.error("usage: creator.js withdraw <address> [amount]"); process.exit(2); }
    const provider = new ethers.JsonRpcProvider(cfg.rpc, cfg.chainId, { staticNetwork: true });
    const w = new ethers.Wallet(secret(cfg.gasKeyFile), provider);
    if ((await provider.getCode(to)) !== "0x" && !rest.includes("--contract")) { console.error("the address is a contract (a profile?): add --contract if that is what you want"); process.exit(1); }
    const balance = await provider.getBalance(w.address);
    const fee = await provider.getFeeData();
    const price = fee.maxFeePerGas || fee.gasPrice;
    const gasLimit = (await provider.getCode(to)) === "0x" ? 21000n : 100000n;
    const amount = rest[1] && rest[1] !== "--contract" ? ethers.parseEther(rest[1]) : balance - gasLimit * price;
    if (amount <= 0n || amount + gasLimit * price > balance) { console.error(`not enough: balance ${ethers.formatEther(balance)}`); process.exit(1); }
    const tx = await w.sendTransaction({ to: ethers.getAddress(to), value: amount, gasLimit, maxFeePerGas: fee.maxFeePerGas || undefined, maxPriorityFeePerGas: fee.maxPriorityFeePerGas || undefined, gasPrice: fee.maxFeePerGas ? undefined : fee.gasPrice });
    console.log(`sent ${ethers.formatEther(amount)} to ${ethers.getAddress(to)}: ${tx.hash}`);
    await tx.wait(1, cfg.confirmSeconds * 1000);
    console.log(`confirmed; balance now ${ethers.formatEther(await provider.getBalance(w.address))}`);
    return;
  }
  console.error("usage: creator.js serve | invite [--days N] [--note TEXT] | invites | revoke <code or id> | status | withdraw <address> [amount]");
  process.exit(2);
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { makeService, serve, loadConfig, newCode, normalize, hashCode };
