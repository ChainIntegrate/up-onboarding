// End-to-end test of the creation service (tools/creator) on a local chain.
//
// A Hardhat node with LUKSO Testnet's chainId and LUKSO's contracts (as test/e2e.js), the IPFS node's API answered locally,
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

const RPC = "http://127.0.0.1:8545";
const PORT = 8788, IPFS = 8789;
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
  const node = spawn("npx", ["hardhat", "node", "--port", "8545"], { cwd: __dirname, stdio: "ignore" });
  const pins = [];
  // Kubo's /api/v0/add, as the node answers it: one JSON line per file.
  const ipfs = http.createServer((req, res) => {
    const chunks = []; req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const u = new URL(req.url, "http://x");
      pins.push({ path: u.pathname, pin: u.searchParams.get("pin"), cid: u.searchParams.get("cid-version"), auth: req.headers.authorization, size: Buffer.concat(chunks).length });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ Name: "f", Hash: "bafybeigdyrztktx5b5m2y4sogf2hf5uq3k5knv5c5k2pvx7aq5ekhtest" + String(pins.length).padStart(2, "0"), Size: "1" }) + "\n");
    });
  }).listen(IPFS);
  let svc;
  try {
    await waitFor(RPC, '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}');
    const prov = new ethers.JsonRpcProvider(RPC, 4201, { staticNetwork: true });
    const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/lukso-contracts.json")));
    for (const [addr, v] of Object.entries(fixtures)) if (addr.startsWith("0x")) await prov.send("hardhat_setCode", [addr, v.code]);
    const gas = ethers.Wallet.createRandom();
    await prov.send("hardhat_setBalance", [gas.address, "0x" + ethers.parseEther("10").toString(16)]);
    fs.writeFileSync(path.join(dir, "gas-key"), gas.privateKey, { mode: 0o600 });
    fs.writeFileSync(path.join(dir, "ipfs-auth"), "Basic dGVzdDp0ZXN0", { mode: 0o600 });
    const config = { network: "lukso-testnet", rpc: RPC, chainId: 4201, gasKeyFile: "gas-key", dataDir: "data",
      ipfsApi: `http://127.0.0.1:${IPFS}/`, ipfsAuthFile: "ipfs-auth", port: PORT, maxPerDay: 2, perIpPerMinute: 2, confirmSeconds: 30 };
    fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify(config));
    const env = { ...process.env, CREATOR_CONFIG: path.join(dir, "config.json") };
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
    const { request } = UPRequest.create({ network: "lukso-testnet",
      profile: { name: "Rossi Srl", description: "Vino", tags: ["vino"], links: [{ title: "Sito", url: "https://www.rossi.it" }] },
      images: { avatar: { dataUrl: avatar, w: 192, h: 192 }, cover: null },
      controllers: [{ address: admin.address, name: "PC ufficio", role: "admin" }, { address: device.address, name: "Telefono", role: "device" }] });
    const sign = (w, req) => w.signMessage(UPRequest.signingMessage(req));

    const code = cli("invite", "--note", "Rossi Srl");
    check(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code), "an invitation code is printed");
    const stored = fs.readFileSync(path.join(dir, "data", "invites.json"), "utf8");
    check(!stored.includes(code) && !stored.includes(code.replace(/-/g, "")), "the code store holds no code in clear");

    let r = await post({ invite: "AAAA-BBBB-CCCC", request, signature: await sign(admin, request) });
    check(r.status === 403 && r.body.error === "invite_invalid", "an unknown code is refused");
    r = await post({ invite: code, request, signature: await sign(stranger, request) });
    check(r.status === 400 && r.body.error === "bad_signature", "a request signed by a key that is not its administrator is refused");
    r = await post({ invite: code, request, signature: await sign(device, request) });
    check(r.status === 400 && r.body.error === "bad_signature", "a request signed by a device key is refused");
    const bad = { ...request, network: "lukso" };
    r = await post({ invite: code, request: bad, signature: await sign(admin, bad) });
    check(r.status === 400 && r.body.problems.includes("network"), "a request for another network is refused");

    r = await post({ invite: code.toLowerCase().replace(/0/g, "o"), request, signature: await sign(admin, request) });
    check(r.status === 200 && ethers.isAddress(r.body.up), "a good request creates the account (code typed in lower case, O for 0)");
    if (r.status === 200) {
      const { up, km } = r.body;
      check((await prov.getCode(up)) !== "0x", "the account exists on the network");
      const read = new ethers.Contract(up, ["function getDataBatch(bytes32[]) view returns (bytes[])"], prov);
      const perm = async (a) => { const v = (await read.getDataBatch(["0x4b80742de2bf82acb3630000" + a.slice(2).toLowerCase()]))[0]; return v === "0x" ? 0n : BigInt(v); };
      check((await perm(admin.address)) === UPDeploy.ADMIN_PERMS && (await perm(device.address)) === UPDeploy.DEVICE_PERMS && (await perm(gas.address)) === 0n,
        "the keys have their permissions, the service's wallet has none");
      const [lsp3] = await read.getDataBatch([UPDeploy.LSP3_KEY]);
      check(ethers.toUtf8String(ethers.dataSlice(lsp3, 40)).startsWith("ipfs://bafybei") && pins.length === 2 &&
        pins.every((p) => p.path === "/api/v0/add" && p.pin === "true" && p.cid === "1" && p.auth === "Basic dGVzdDp0ZXN0"),
        "the image and the profile are added and pinned on the IPFS node");
      check(km && (await prov.getCode(km)) !== "0x", "the Key Manager exists");
    }
    const look = async (address) => { const x = await fetch(`http://127.0.0.1:${PORT}/api/lookup`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "10.9.9.9" }, body: JSON.stringify({ address }) }); return { status: x.status, body: await x.json() }; };
    const created = r.body.up;
    let l = await look(device.address);
    check(l.status === 200 && l.body.up === created && l.body.network === "lukso-testnet", "an account is found by one of its keys");
    l = await look(stranger.address);
    check(l.status === 404, "a key with no account is not found");
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
    check(left < ethers.parseEther("0.001") && (await prov.getBalance(mine)) > ethers.parseEther("9"), "withdraw sends everything but the fee");
  } finally {
    if (svc) svc.kill();
    node.kill(); ipfs.close();
  }
  console.log(failures ? `${failures} check(s) failed` : "all checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
