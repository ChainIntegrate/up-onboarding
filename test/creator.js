// End-to-end test of the account service (tools/creator) on a local chain.
//
// A Hardhat node with LUKSO's chainId (42) and LUKSO's contracts (as test/e2e.js), the IPFS node's API answered locally,
// the service started as on the server. Checked: an unknown code, a request signed by a key that is not one of
// its administrators and an invalid request are refused; a good request creates the account, which is then read
// back with its keys and permissions; the code cannot be used twice; a revoked code is refused; the per-IP and
// daily limits hold; the code store keeps hashes only.
"use strict";
const { spawn, execFileSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ethers } = require("ethers");
const UPRequest = require("../shared/request.js");
const UPDeploy = require("../shared/deploy.js");
const UPRelay = require("../shared/relay.js");

const RPC = "http://127.0.0.1:8545";
const PORT = 8788, IPFS = 8789, EXPLORER = 8790;
const CREATOR = path.join(__dirname, "..", "tools", "creator", "creator.js");
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? "ok  " : "FAIL"} ${label}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, body) {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(url, body ? { method: "POST", headers: { "content-type": "application/json" }, body } : {}); if (r.ok) return; } catch (e) { /* not yet */ }
    await sleep(250);
  }
  throw new Error("not started: " + url);
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "creator-"));
  const node = spawn("npx", ["hardhat", "node", "--port", "8545"], { cwd: __dirname, stdio: "ignore", detached: true, env: { ...process.env, CHAIN_ID: "42" } });
  const pins = [];
  // Kubo's /api/v0/add (one JSON line per file) and /api/v0/cat, as the node answers them; the files are kept.
  const ipfsFiles = new Map();
  const warmed = [];
  const ipfs = http.createServer((req, res) => {
    const chunks = []; req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const u = new URL(req.url, "http://x");
      if (u.pathname.startsWith("/ipfs/")) { // a public gateway (warmGateways): asked for the new files before the account is written
        warmed.push(u.pathname.slice(6));
        const f = ipfsFiles.get(u.pathname.slice(6));
        res.writeHead(f ? 200 : 404); return res.end(f || "");
      }
      if (u.pathname === "/api/v0/cat") {
        const f = ipfsFiles.get(u.searchParams.get("arg"));
        res.writeHead(f ? 200 : 404); return res.end(f || "");
      }
      const body = Buffer.concat(chunks);
      const boundary = "--" + String(req.headers["content-type"]).split("boundary=")[1];
      const start = body.indexOf("\r\n\r\n") + 4, end = body.indexOf("\r\n" + boundary, start);
      pins.push({ path: u.pathname, pin: u.searchParams.get("pin"), cid: u.searchParams.get("cid-version"), auth: req.headers.authorization, size: body.length });
      const hash = "bafybeigdyrztktx5b5m2y4sogf2hf5uq3k5knv5c5k2pvx7aq5ekhtest" + String(pins.length).padStart(2, "0");
      ipfsFiles.set(hash, body.slice(start, end));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ Name: "f", Hash: hash, Size: "1" }) + "\n");
    });
  }).listen(IPFS);
  // LUKSO's explorer (Blockscout API v2), as it lists an address's transactions: two pages, the creation on the
  // second one, a transfer on the first.
  const explorerTxs = [];
  const explorer = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    const page2 = u.searchParams.get("page") === "2";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(page2 ? { items: explorerTxs, next_page_params: null }
      : { items: [{ hash: "0x" + "11".repeat(32), to: { hash: "0x000000000000000000000000000000000000dEaD" }, status: "ok" }], next_page_params: { page: 2 } }));
  }).listen(EXPLORER);
  let svc;
  try {
    await waitFor(RPC, '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}');
    const prov = new ethers.JsonRpcProvider(RPC, 42, { staticNetwork: true });
    const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/lukso-contracts.json")));
    for (const [addr, v] of Object.entries(fixtures)) if (addr.startsWith("0x")) await prov.send("hardhat_setCode", [addr, v.code]);
    const gas = ethers.Wallet.createRandom();
    await prov.send("hardhat_setBalance", [gas.address, "0x" + ethers.parseEther("10").toString(16)]);
    fs.writeFileSync(path.join(dir, "gas-key"), gas.privateKey, { mode: 0o600 });
    fs.writeFileSync(path.join(dir, "ipfs-auth"), "Basic dGVzdDp0ZXN0", { mode: 0o600 });
    fs.writeFileSync(path.join(dir, "rpc-url"), RPC + "\n", { mode: 0o600 });
    const config = { network: "lukso", rpcFile: "rpc-url", chainId: 42, gasKeyFile: "gas-key", dataDir: "data", backupDir: "backups", warmGateways: [`http://127.0.0.1:${IPFS}/ipfs/`], explorerApi: `http://127.0.0.1:${EXPLORER}/api/v2/`,
      ipfsApi: `http://127.0.0.1:${IPFS}/`, ipfsAuthFile: "ipfs-auth", port: PORT, maxPerDay: 2, perIpPerMinute: 2, confirmSeconds: 30, maxRelayPerDay: 11, relayPerIpPerMinute: 100 };
    fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify(config));
    const env = { ...process.env, CREATOR_CONFIG: path.join(dir, "config.json") };
    // Commands that talk to the explorer stub (served by this process) run without blocking it.
    const cliAsync = (...args) => new Promise((res, rej) => require("child_process").execFile(process.execPath, [CREATOR, ...args], { env, encoding: "utf8" }, (e, out, err) => (e ? rej(new Error(err || e.message)) : res(out.trim()))));
    const cli = (...args) => execFileSync(process.execPath, [CREATOR, ...args], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    svc = spawn(process.execPath, [CREATOR, "serve"], { env, stdio: ["ignore", "inherit", "inherit"] });
    await waitFor(`http://127.0.0.1:${PORT}/api/health`);

    let ipN = 0;
    const post = async (body, ip) => {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/create`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": ip || `10.0.0.${++ipN}` }, body: JSON.stringify(body) });
      return { status: r.status, body: await r.json() };
    };
    const admin = ethers.Wallet.createRandom(), device = ethers.Wallet.createRandom(), stranger = ethers.Wallet.createRandom();
    const avatar = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "..", "web", "icon-192.png")).toString("base64");
    const { request } = UPRequest.create({ network: "lukso",
      profile: { name: "rossi-srl", description: "Vino", tags: ["vino"], links: [{ title: "Sito", url: "https://www.rossi.it" }] },
      images: { avatar: { dataUrl: avatar, w: 192, h: 192 }, cover: null },
      controllers: [{ address: admin.address, name: "PC ufficio", role: "admin" }, { address: device.address, name: "Telefono", role: "device" }] });
    const sign = (w, req) => w.signMessage(UPRequest.signingMessage(req));

    const inv = require("child_process").spawnSync(process.execPath, [CREATOR, "invite", "--note", "Rossi Srl"], { env, encoding: "utf8" });
    const code = inv.stdout.trim();
    check(inv.stderr.includes(`link: https://account.chainintegrate.it/#invito=${code}`), "invite: the invitation link to send the client, the code after # (not sent to the server)");
    check(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code), "an invitation code is printed");
    const stored = fs.readFileSync(path.join(dir, "data", "invites.json"), "utf8");
    check(!stored.includes(code) && !stored.includes(code.replace(/-/g, "")), "the code store holds no code in clear");

    let r = await post({ invite: "AAAA-BBBB-CCCC", request, signature: await sign(admin, request) });
    check(r.status === 403 && r.body.error === "invite_invalid", "an unknown code is refused");
    r = await post({ invite: code, request, signature: await sign(stranger, request) });
    check(r.status === 400 && r.body.error === "bad_signature", "a request signed by a key that is not its administrator is refused");
    r = await post({ invite: code, request, signature: await sign(device, request) });
    check(r.status === 400 && r.body.error === "bad_signature", "a request signed by a device key is refused");
    const badName = { ...request, profile: { ...request.profile, name: "Rossi_Srl" } };
    r = await post({ invite: code, request: badName, signature: await sign(admin, badName) });
    check(r.status === 400 && r.body.problems.includes("profile.nameRule"), "a name that breaks the rule is refused");
    const webp = { ...request, images: { avatar: { dataUrl: "data:image/webp;base64,UklGRiQAAABXRUJQ", w: 1, h: 1 }, cover: null } };
    r = await post({ invite: code, request: webp, signature: await sign(admin, webp) });
    check(r.status === 400 && r.body.problems.includes("images.avatar"), "a WebP picture is refused");
    const bad = { ...request, network: "lukso-testnet" };
    r = await post({ invite: code, request: bad, signature: await sign(admin, bad) });
    check(r.status === 400 && r.body.problems.includes("network"), "a request for another network is refused");

    r = await post({ invite: code.toLowerCase().replace(/0/g, "o"), request, signature: await sign(admin, request) });
    check(r.status === 200 && ethers.isAddress(r.body.up), "a good request creates the account (code typed in lower case, O for 0)");
    if (r.status === 200) {
      const { up, km } = r.body;
      check((await prov.getCode(up)) !== "0x", "the account exists on the network");
      const read = new ethers.Contract(up, ["function getDataBatch(bytes32[]) view returns (bytes[])"], prov);
      const perm = async (a) => { const v = (await read.getDataBatch(["0x4b80742de2bf82acb3630000" + a.slice(2).toLowerCase()]))[0]; return v === "0x" ? 0n : BigInt(v); };
      check((await perm(admin.address)) === UPDeploy.ADMIN_PERMS && (await perm(device.address)) === UPRelay.ACCESS_PERMS && UPDeploy.DEVICE_PERMS === UPRelay.ACCESS_PERMS && (await perm(gas.address)) === 0n,
        "the keys have their permissions, the service's wallet has none");
      const [lsp3] = await read.getDataBatch([UPDeploy.LSP3_KEY]);
      check(ethers.toUtf8String(ethers.dataSlice(lsp3, 40)).startsWith("ipfs://bafybei") && pins.length === 2 &&
        pins.every((p) => p.path === "/api/v0/add" && p.pin === "true" && p.cid === "1" && p.auth === "Basic dGVzdDp0ZXN0"),
        "the image and the profile are added and pinned on the IPFS node");
      check(km && (await prov.getCode(km)) !== "0x", "the Key Manager exists");
      const profileCid = ethers.toUtf8String(ethers.dataSlice(lsp3, 40)).replace("ipfs://", "");
      check(warmed.includes(profileCid) && warmed.length >= 2, "before writing the account, the gateway of LUKSO's indexer is asked for the new profile and picture");
    }
    const look = async (address) => { const x = await fetch(`http://127.0.0.1:${PORT}/api/lookup`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "10.9.9.9" }, body: JSON.stringify({ address }) }); return { status: x.status, body: await x.json() }; };
    const created = r.body.up;
    let l = await look(device.address);
    check(l.status === 200 && l.body.up === created && l.body.network === "lukso", "an account is found by one of its keys");
    l = await look(stranger.address);
    check(l.status === 404, "a key with no account is not found");
    // ---- the profile read back for an extension restored from its backup
    const rd = await fetch(`http://127.0.0.1:${PORT}/api/profile/read`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "10.6.6.6" }, body: JSON.stringify({ account: created, signer: admin.address }) });
    const rdb = await rd.json();
    check(rd.status === 200 && rdb.name === request.profile.name && rdb.description === request.profile.description && /^ipfs:\/\//.test(rdb.picture) && rdb.deviceName === "PC ufficio",
      "profile read: the account's name, description, picture and the key's name on it" + ` [${JSON.stringify(rdb).slice(0, 160)}]`);
    // ---- the list of created accounts: backed up, and rebuilt from the network when lost
    const out = cli("backup");
    const copies = fs.readdirSync(path.join(dir, "backups"));
    const listed = execFileSync("tar", ["-tzf", path.join(dir, "backups", copies[0])], { encoding: "utf8" });
    check(copies.length === 1 && /^up-onboarding-\d{4}-\d{2}-\d{2}\.tar\.gz$/.test(copies[0]) && (fs.statSync(path.join(dir, "backups", copies[0])).mode & 0o077) === 0 &&
      /created\.jsonl/.test(listed) && /invites\.json/.test(listed), "backup: a dated copy of the codes and of the created accounts, readable by the service only" + ` [${out}]`);
    for (const d of ["2020-01-01", "2020-01-02"]) fs.writeFileSync(path.join(dir, "backups", `up-onboarding-${d}.tar.gz`), "old");
    fs.writeFileSync(path.join(dir, "config-keep1.json"), JSON.stringify({ ...config, backupKeep: 2 }));
    execFileSync(process.execPath, [CREATOR, "backup"], { env: { ...env, CREATOR_CONFIG: path.join(dir, "config-keep1.json") }, stdio: "ignore" });
    check(fs.readdirSync(path.join(dir, "backups")).sort().join() === ["up-onboarding-2020-01-02.tar.gz", copies[0]].sort().join(), "backup: only the latest copies are kept");
    explorerTxs.push({ hash: r.body.tx, to: { hash: UPDeploy.FACTORY }, status: "ok" });
    const createdFile = path.join(dir, "data", "created.jsonl");
    const before = fs.readFileSync(createdFile, "utf8");
    fs.writeFileSync(createdFile, "");
    check((await look(device.address)).status === 404, "rebuild: with the list lost, the account is unknown to the service");
    const rb = await cliAsync("rebuild");
    const rebuilt = fs.readFileSync(createdFile, "utf8").split("\n").filter(Boolean).map((x) => JSON.parse(x));
    check(rebuilt.length === 1 && rebuilt[0].up === created && rebuilt[0].km === r.body.km && rebuilt[0].tx === r.body.tx && rebuilt[0].rebuilt === true &&
      rebuilt[0].keys.join() === [admin.address, device.address].join(), "rebuild: the account, its Key Manager and its keys come back from the network" + ` [${rb.split("\n").pop()}]`);
    l = await look(device.address);
    check(l.status === 200 && l.body.up === created, "rebuild: the service knows the account again");
    await cliAsync("rebuild");
    check(fs.readFileSync(createdFile, "utf8").split("\n").filter(Boolean).length === 1, "rebuild: run again, it adds nothing twice");
    fs.writeFileSync(createdFile, before);
    // ---- relay: operations on the account, gas paid by the service (LSP25)
    const relayPost = async (pathName, body) => { const x = await fetch(`http://127.0.0.1:${PORT}/api/relay${pathName}`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "10.8.8.8" }, body: JSON.stringify(body) }); return { status: x.status, body: await x.json() }; };
    const read1 = new ethers.Contract(created, ["function getData(bytes32) view returns (bytes)"], prov);
    async function relay(wallet, payload, { nonce, validity, account = created } = {}) {
      const n = await relayPost("/nonce", { account, signer: wallet.address });
      if (n.status !== 200) return n;
      const v = validity ?? UPRelay.validity(0, n.body.time + 600);
      const useNonce = nonce ?? BigInt(n.body.nonce);
      const digest = UPRelay.digest({ chainId: n.body.chainId, keyManager: n.body.keyManager, nonce: useNonce, validity: v, payload });
      const sig = wallet.signingKey.sign(digest).serialized;
      return relayPost("", { account, nonce: useNonce.toString(), validity: v.toString(), payload, signature: sig });
    }
    const nameOf = async (a) => { const v = await read1.getData(UPRelay.nameKey(a.address)); return v === "0x" ? "" : ethers.toUtf8String(v); };
    let rr = await relay(admin, UPRelay.UP.encodeFunctionData("setData", [UPRelay.nameKey(admin.address), ethers.hexlify(ethers.toUtf8Bytes("Portatile Simone"))]));
    check(rr.status === 200 && (await nameOf(admin)) === "Portatile Simone", "relay: the key renames itself on the account, the service pays");
    const newProfile = ethers.concat(["0x00006f357c6a0020", ethers.keccak256("0x1234"), ethers.toUtf8Bytes("ipfs://bafkreigdyrztktx5b5m2y4sogf2hf5uq3k5knv5c5k2pvx7aq5ekhtest99")]);
    rr = await relay(admin, UPRelay.UP.encodeFunctionData("setData", [UPRelay.LSP3_KEY, newProfile]));
    check(rr.status === 200 && (await read1.getData(UPRelay.LSP3_KEY)).toLowerCase() === newProfile.toLowerCase(), "relay: the profile is updated");
    // a new profile stored by the service on IPFS, asked by a key of the account, then written with the relay
    const upd = UPRequest.profileUpdate({ account: created, profile: { name: "rossi-srl", description: "Vino toscano, nuova descrizione", tags: [], links: [] }, images: { avatar: { dataUrl: avatar, w: 192, h: 192 }, cover: null } }).update;
    const profilePost = async (body) => { const x = await fetch(`http://127.0.0.1:${PORT}/api/profile`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "10.8.8.9" }, body: JSON.stringify(body) }); return { status: x.status, body: await x.json() }; };
    let pp = await profilePost({ update: upd, signature: await stranger.signMessage(UPRequest.updateMessage(upd)) });
    check(pp.status === 400 && pp.body.error === "bad_signature", "profile: a key that is not the account's cannot store a profile");
    const badUpd = { ...upd, profile: { ...upd.profile, name: "Rossi_Srl" } };
    pp = await profilePost({ update: badUpd, signature: await admin.signMessage(UPRequest.updateMessage(badUpd)) });
    check(pp.status === 400 && pp.body.problems.includes("profile.nameRule"), "profile: the name rule holds for an update too");
    const pinsBefore = pins.length;
    pp = await profilePost({ update: upd, signature: await admin.signMessage(UPRequest.updateMessage(upd)) });
    check(pp.status === 200 && /^ipfs:\/\//.test(pp.body.url) && pins.length === pinsBefore + 2, "profile: a key of the account has the new profile and picture stored");
    rr = await relay(admin, UPRelay.setProfile(pp.body.value));
    check(rr.status === 200 && (await read1.getData(UPRelay.LSP3_KEY)).toLowerCase() === pp.body.value.toLowerCase(), "profile: its value is written with the relay");
    const jsonAt = (url) => JSON.parse(ipfsFiles.get(url.replace("ipfs://", "")).toString("utf8")).LSP3Profile;
    const pictureBefore = jsonAt(pp.body.url).profileImage;
    const keep = UPRequest.profileUpdate({ account: created, profile: { name: "rossi-srl", description: "Solo la descrizione cambia", tags: [], links: [] }, images: { avatar: null, cover: null }, keepPicture: true }).update;
    pp = await profilePost({ update: keep, signature: await admin.signMessage(UPRequest.updateMessage(keep)) });
    check(pp.status === 200 && jsonAt(pp.body.url).description === "Solo la descrizione cambia" && JSON.stringify(jsonAt(pp.body.url).profileImage) === JSON.stringify(pictureBefore) && pictureBefore.length === 1,
      "profile: an update without a new picture keeps the current one (read back with its hash)");
    rr = await relay(admin, UPRelay.UP.encodeFunctionData("setData", [UPRelay.nameKey(device.address), ethers.hexlify(ethers.toUtf8Bytes("x"))]));
    check(rr.status === 400 && rr.body.error === "not_allowed", "relay: a key cannot rename another key");
    rr = await relay(admin, UPRelay.UP.encodeFunctionData("setData", ["0x4b80742de2bf82acb3630000" + stranger.address.slice(2).toLowerCase(), ethers.zeroPadValue("0x7f3f06", 32)]));
    check(rr.status === 400 && rr.body.error === "not_allowed", "relay: adding a controller is not allowed");
    rr = await relay(admin, UPRelay.UP.encodeFunctionData("execute", [0, stranger.address, ethers.parseEther("1"), "0x"]));
    check(rr.status === 400 && rr.body.error === "not_allowed", "relay: a transfer from the account is refused (not in the catalog)");
    // ---- /api/rpc: the extension reads the network through the service (the node's URL stays in rpc-url)
    const rpcPost = async (body, ip = "10.7.7.7") => { const x = await fetch(`http://127.0.0.1:${PORT}/api/rpc`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": ip }, body: JSON.stringify(body) }); return { status: x.status, body: await x.json() }; };
    let rp = await rpcPost({ jsonrpc: "2.0", id: 5, method: "eth_blockNumber", params: [] });
    check(rp.status === 200 && rp.body.id === 5 && /^0x[0-9a-f]+$/.test(rp.body.result), "rpc: a reading is answered by the node");
    rp = await rpcPost({ jsonrpc: "2.0", id: 6, method: "eth_call", params: [{ to: created, data: "0x8da5cb5b" }, "latest"] });
    check(rp.status === 200 && ethers.isHexString(rp.body.result, 32), "rpc: a contract is read (the account's owner)");
    rp = await rpcPost({ jsonrpc: "2.0", id: 7, method: "eth_sendRawTransaction", params: ["0x00"] });
    check(rp.status === 400 && rp.body.reason === "rpc_method", "rpc: anything but reading is refused");
    rp = await rpcPost([{ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }]);
    check(rp.status === 400, "rpc: one call per request (no batches)");
    rp = await rpcPost({ jsonrpc: "2.0", id: 8, method: "eth_getLogs", params: [{ address: created, fromBlock: "0x0", toBlock: "0x1000000" }] });
    check(rp.status === 400 && rp.body.reason === "rpc_logs_range", "rpc: logs over too many blocks are refused");
    rp = await rpcPost({ jsonrpc: "2.0", id: 9, method: "eth_getLogs", params: [{ address: created, fromBlock: "0x0", toBlock: "0x10" }] });
    check(rp.status === 200 && Array.isArray(rp.body.result), "rpc: logs of one address over a few blocks are read");
    // ---- the projects' catalog (shared/catalog.js): stand-ins at the projects' addresses on LUKSO
    const RET_TRUE = "0x600160005260206000f3", RET_FALSE = "0x600060005260206000f3"; // any call answers true / false
    const TRACE_FACTORY = "0x54C3A7C31C4eCA1f1997f5E6f19197f3A82b88a3", SUPPLIER = "0xFa143308D85b81Ed57547049F4A7718c3117A064";
    const REG = ethers.Wallet.createRandom().address;
    await prov.send("hardhat_setCode", [SUPPLIER, "0x00"]); await prov.send("hardhat_setCode", [REG, "0x00"]);
    await prov.send("hardhat_setCode", [TRACE_FACTORY, RET_FALSE]);
    const lots = new ethers.Interface(["function mintRawMaterialLotBatch(bytes32[],bytes[],uint256[])"]).encodeFunctionData("mintRawMaterialLotBatch", [[ethers.ZeroHash], ["0x"], [1]]);
    rr = await relay(admin, UPRelay.projectCall(REG, lots));
    check(rr.status === 400 && rr.body.reason === "not_a_project_contract", "catalog: a registry the project's factory does not know is refused before sending");
    await prov.send("hardhat_setCode", [TRACE_FACTORY, RET_TRUE]);
    rr = await relay(admin, UPRelay.projectCall(REG, lots));
    check(rr.status === 200 && rr.body.ops[0].project === "traceability" && rr.body.ops[0].target === REG, "catalog: a registry made by the factory: the account's call is sent, the service pays");
    rr = await relay(admin, UPRelay.projectCall(SUPPLIER, new ethers.Interface(["function setTierLimits(address,uint8,uint256,uint256,bool,uint256,bool)"]).encodeFunctionData("setTierLimits", [admin.address, 1, 1, 1, true, 1, true])));
    check(rr.status === 400 && rr.body.reason === "not_in_catalog", "catalog: ChainIntegrate's administration is refused");
    const relayLog = fs.readFileSync(path.join(dir, "data", "relay.jsonl"), "utf8");
    check(/traceability:mintRawMaterialLotBatch/.test(relayLog), "catalog: the relay log names the project and the operation");
    rr = await relay(stranger, UPRelay.UP.encodeFunctionData("setData", [UPRelay.nameKey(stranger.address), ethers.hexlify(ethers.toUtf8Bytes("intruso"))]));
    check(rr.status === 422 && rr.body.error === "refused" && /^NoPermissionsSet\(/.test(rr.body.reason), "relay: a key that is not the account's is refused before sending (no gas spent), with the Key Manager's reason" + ` [${rr.body.reason}]`);
    rr = await relay(device, UPRelay.UP.encodeFunctionData("setData", [UPRelay.nameKey(device.address), ethers.hexlify(ethers.toUtf8Bytes("Telefono 2"))]));
    check(rr.status === 200 && (await nameOf(device)) === "Telefono 2", "relay: a device key (the extension's access) renames its own computer");
    rr = await relay(device, UPRelay.setName(admin.address, "non mio"));
    check(rr.status === 400 && rr.body.error === "not_allowed", "relay: a device key cannot rename another key");
    rr = await relay(admin, UPRelay.UP.encodeFunctionData("setData", [UPRelay.nameKey(admin.address), ethers.hexlify(ethers.toUtf8Bytes("Di nuovo"))]), { nonce: 0n });
    check(rr.status === 422, "relay: a used nonce is refused (no replay)");
    const old = Math.floor(Date.now() / 1000) - 7200;
    rr = await relay(admin, UPRelay.UP.encodeFunctionData("setData", [UPRelay.nameKey(admin.address), ethers.hexlify(ethers.toUtf8Bytes("Scaduto"))]), { validity: UPRelay.validity(old, old + 600) });
    check(rr.status === 400 && rr.body.problems.includes("validity"), "relay: an expired request is refused");
    rr = await relay(admin, UPRelay.UP.encodeFunctionData("setData", [UPRelay.nameKey(admin.address), ethers.hexlify(ethers.toUtf8Bytes("Altro"))]), { account: stranger.address });
    check(rr.status === 403 && rr.body.error === "unknown_account", "relay: only accounts the service created");
    // ---- a second device on the account: authorized by an administrator, with its own key, and revoked
    const third = ethers.Wallet.createRandom();
    const readP = async (signer) => { const x = await fetch(`http://127.0.0.1:${PORT}/api/profile/read`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "10.4.4.4" }, body: JSON.stringify({ account: created, signer }) }); return x.json(); };
    const lookDev = async (address) => { const x = await fetch(`http://127.0.0.1:${PORT}/api/lookup`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "10.5.5.5" }, body: JSON.stringify({ address }) }); return { status: x.status, body: await x.json() }; };
    let pr = await readP(admin.address);
    check(pr.role === "admin" && pr.keys.length === 3 && pr.devices.length === 2 && pr.devices.find((d) => d.address === device.address).role === "access",
      "devices: the account's keys are listed with their role (LUKSO's delegate left out)");
    check((await lookDev(third.address)).status === 404, "devices: a new computer's key is unknown before it is authorized");
    const addPayload = UPRelay.addDevice({ length: pr.keys.length, address: third.address, role: "access", name: "Computer ufficio" });
    rr = await relay(device, addPayload);
    check(rr.status === 422, "devices: a device key cannot authorize another one");
    const parts = UPRelay.UP.decodeFunctionData("setDataBatch", addPayload);
    rr = await relay(admin, UPRelay.UP.encodeFunctionData("setDataBatch", [[...parts[0], UPRelay.LSP3_KEY], [...parts[1], "0x1234"]]));
    check(rr.status === 400 && rr.body.reason === "device_change", "devices: an authorization with anything more written is refused");
    rr = await relay(admin, UPRelay.UP.encodeFunctionData("setDataBatch", [parts[0], [parts[1][0], parts[1][1], ethers.zeroPadValue("0x7f3f07", 32), ...parts[1].slice(3)]]));
    check(rr.status === 400 && rr.body.reason === "device_change", "devices: permissions other than administrator or access are refused");
    rr = await relay(admin, UPRelay.addDevice({ length: pr.keys.length - 1, address: third.address, role: "access", name: "Computer ufficio" }));
    check(rr.status === 409 && rr.body.reason === "keys_changed", "devices: a request made on an outdated list of keys is refused");
    rr = await relay(admin, addPayload);
    const permOf = async (a) => { const v = await read1.getData(UPRelay.permKey(a)); return v === "0x" ? 0n : BigInt(v); };
    check(rr.status === 200 && rr.body.ops[0].op === "addDevice" && (await permOf(third.address)) === UPRelay.ACCESS_PERMS && (await nameOf(third)) === "Computer ufficio",
      "devices: an administrator authorizes a new computer (access), the service pays");
    const lk = await lookDev(third.address);
    check(lk.status === 200 && lk.body.up === created, "devices: the new computer finds the account by itself (lookup on the network)");
    pr = await readP(third.address);
    check(pr.role === "access" && pr.devices.length === 3, "devices: the new computer sees its role and the list");
    rr = await relay(third, UPRelay.setName(third.address, "PC ufficio 2"));
    check(rr.status === 200 && (await nameOf(third)) === "PC ufficio 2", "devices: an access key renames its own computer");
    rr = await relay(third, UPRelay.setProfile(ethers.concat(["0x00006f357c6a0020", ethers.keccak256("0x12"), ethers.toUtf8Bytes("ipfs://bafkreigdyrztktx5b5m2y4sogf2hf5uq3k5knv5c5k2pvx7aq5ekhtest01")])));
    check(rr.status === 422 && /NotAllowedERC725YDataKey/.test(rr.body.reason), "devices: an access key cannot change the profile" + ` [${rr.body.reason}]`);
    rr = await relay(third, UPRelay.addDevice({ length: pr.keys.length, address: stranger.address, role: "admin", name: "x" }));
    check(rr.status === 422 && /NotAuthorised/.test(rr.body.reason), "devices: an access key cannot authorize devices" + ` [${rr.body.reason}]`);
    rr = await relay(admin, UPRelay.removeDevice({ list: pr.keys, address: admin.address }));
    check(rr.status === 400 && rr.body.reason === "own_key", "devices: a computer cannot revoke itself");
    rr = await relay(admin, UPRelay.removeDevice({ list: pr.keys, address: pr.keys[0] }));
    check(rr.status === 400 && rr.body.reason === "not_a_device", "devices: LUKSO's delegate cannot be removed");
    rr = await relay(admin, UPRelay.removeDevice({ list: pr.keys, address: device.address }));
    pr = await readP(admin.address);
    check(rr.status === 200 && (await permOf(device.address)) === 0n && (await nameOf(device)) === "" && pr.keys.length === 3 && pr.keys.includes(third.address) && !pr.keys.includes(device.address),
      "devices: an administrator revokes a device (not the last of the list: the last takes its place)");
    check((await lookDev(device.address)).status === 404, "devices: a revoked key no longer finds the account");
    rr = await relay(device, UPRelay.setName(device.address, "ancora io"));
    check(rr.status === 422, "devices: a revoked key can do nothing more");
    rr = await relay(admin, UPRelay.UP.encodeFunctionData("setData", [UPRelay.nameKey(admin.address), ethers.hexlify(ethers.toUtf8Bytes("Terzo"))]));
    check(rr.status === 200 && (await nameOf(admin)) === "Terzo", "relay: a third operation, under the cap");
    rr = await relay(admin, UPRelay.UP.encodeFunctionData("setData", [UPRelay.nameKey(admin.address), ethers.hexlify(ethers.toUtf8Bytes("Quarto"))]));
    check(rr.status === 429 && rr.body.error === "daily_limit" && (await nameOf(admin)) === "Terzo", "relay: the daily cap holds");

    r = await post({ invite: code, request, signature: await sign(admin, request) });
    check(r.status === 409 && r.body.error === "invite_used", "a code cannot be used twice");

    const code2 = cli("invite"); cli("revoke", code2);
    r = await post({ invite: code2, request, signature: await sign(admin, request) });
    check(r.status === 403, "a revoked code is refused");

    r = await post({ invite: "AAAA-BBBB-CCCC", request, signature: "0x" }, "9.9.9.9");
    r = await post({ invite: "AAAA-BBBB-CCCC", request, signature: "0x" }, "9.9.9.9");
    r = await post({ invite: "AAAA-BBBB-CCCC", request, signature: "0x" }, "9.9.9.9");
    check(r.status === 429 && r.body.error === "rate_limited", "requests from one address are limited per minute");

    const code3 = cli("invite"), code4 = cli("invite");
    const admin2 = ethers.Wallet.createRandom();
    const req2 = UPRequest.create({ ...request, controllers: [{ address: admin2.address, name: "", role: "admin" }] }).request;
    r = await post({ invite: code3, request: req2, signature: await sign(admin2, req2) });
    check(r.status === 200, "a second account is created");
    r = await post({ invite: code4, request: req2, signature: await sign(admin2, req2) });
    check(r.status === 429 && r.body.error === "daily_limit", "the daily limit holds");
    check(/created today 2 of 2/.test(cli("status")), "status counts today's accounts");
    check(cli("invites").split("\n").length === 4, "the codes are listed");

    // ---- alerts (alert.js check), e-mails to a file
    const outbox = path.join(dir, "outbox.jsonl");
    const ALERT = path.join(__dirname, "..", "tools", "creator", "alert.js");
    const alert = (...a) => execFileSync(process.execPath, [ALERT, ...a], { env: { ...env, ALERT_OUTBOX: outbox }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    const mails = () => (fs.existsSync(outbox) ? fs.readFileSync(outbox, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
    alert("check");
    check(mails().length === 1 && /daily cap/.test(mails()[0].text), "alerts: the relay's daily cap sends an e-mail");
    fs.unlinkSync(path.join(dir, "data", "relay.jsonl"));
    alert("check");
    check(mails().length === 2 && /solved/.test(mails()[1].subject), "alerts: and a second when it is over");
    fs.unlinkSync(outbox);
    check(alert("check") === "all good" && mails().length === 0, "alerts: all good, no e-mail");
    svc.kill(); await sleep(500);
    alert("check");
    check(mails().length === 1 && /a problem/.test(mails()[0].subject) && /does not answer/.test(mails()[0].text), "alerts: the service down sends an e-mail");
    alert("check");
    check(mails().length === 1, "alerts: the same problem is not sent again at once");
    svc = spawn(process.execPath, [CREATOR, "serve"], { env, stdio: ["ignore", "inherit", "inherit"] });
    await waitFor(`http://127.0.0.1:${PORT}/api/health`);
    alert("check");
    check(mails().length === 2 && /solved/.test(mails()[1].subject), "alerts: an e-mail when it is solved");
    await prov.send("hardhat_setBalance", [gas.address, "0x" + ethers.parseEther("0.06").toString(16)]);
    alert("check");
    check(mails().length === 3 && /top it up/.test(mails()[2].text), "alerts: a low gas wallet sends an e-mail");
    await prov.send("hardhat_setBalance", [gas.address, "0x" + ethers.parseEther("10").toString(16)]);
    alert("failed", "up-onboarding-creator.service");
    check(/service is down/.test(mails()[3].subject) && /journalctl/.test(mails()[3].text), "alerts: the e-mail when systemd gives up");
    const mine = ethers.Wallet.createRandom().address;
    cli("withdraw", mine, "1.5");
    check((await prov.getBalance(mine)) === ethers.parseEther("1.5"), "withdraw sends an amount to the operator's address");
    cli("withdraw", mine);
    const left = await prov.getBalance(gas.address);
    check(left === 0n && (await prov.getBalance(mine)) > ethers.parseEther("9"), "withdraw sends everything but the fee (nothing left)" + ` [left ${left}]`);
  } finally {
    if (svc) svc.kill();
    try { process.kill(-node.pid); } catch (e) { node.kill(); } ipfs.close(); explorer.close(); // npx and the node it starts
  }
  console.log(failures ? `${failures} check(s) failed` : "all checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
