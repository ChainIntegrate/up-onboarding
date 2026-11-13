// End-to-end test of the pages on a local chain: web/index.html (the client's) and web/operator.html.
//
// A Hardhat node with LUKSO Testnet's chainId gets LUKSO's own contracts at their official addresses
// (test/fixtures/lukso-contracts.json, bytecode from LUKSO's npm packages). The page runs in Chromium; the
// CDN (ethers, same bytes as the page's integrity hash) and LUKSO's RPC are served locally, and a test wallet
// announced through EIP-6963 sends with the node's first account. Checked:
// - the page creates the UP, and its own check after the transaction passes;
// - on the new UP, a device key can change its own name but not LSP3Profile nor add a controller; an administrator can;
// - the LYX step funds each key; the request file is saved and loads back;
// - IPFS mode (the node's API answered locally) puts an ipfs:// URL in the profile; no horizontal scroll at phone width;
// - the client's page uses no crypto term, in Italian or in English.
"use strict";
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { ethers } = require("ethers");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(__dirname, "out");
const RPC = "http://127.0.0.1:8545";
const PORT = 8766;
const ETHERS_FILE = path.join(ROOT, "node_modules/ethers/dist/ethers.umd.min.js");
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? "ok  " : "FAIL"} ${label}`); if (!ok) failures++; };

function serveWeb() {
  const types = { ".html": "text/html", ".js": "application/javascript", ".png": "image/png", ".ico": "image/x-icon" };
  return http.createServer((req, res) => {
    const p = path.join(ROOT, "web", decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!p.startsWith(path.join(ROOT, "web")) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  }).listen(PORT);
}

async function waitRpc() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' }); if (r.ok) return; } catch (e) { await new Promise((r) => setTimeout(r, 500)); }
  }
  throw new Error("hardhat node did not start");
}

async function newPage(browser, operator, opts = {}) {
  const page = await browser.newPage(opts);
  page.on("pageerror", (e) => check(false, "page error: " + e.message));
  await page.route("https://cdnjs.cloudflare.com/**", (r) => r.fulfill({ path: ETHERS_FILE, contentType: "application/javascript", headers: { "access-control-allow-origin": "*" } }));
  await page.route("https://rpc.testnet.lukso.network/**", async (r) => {
    const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: r.request().postData() });
    r.fulfill({ status: 200, body: await res.text(), headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
  });
  await page.addInitScript((op) => {
    const provider = { request: async ({ method, params }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [op];
      const res = await fetch("https://rpc.testnet.lukso.network", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params || [] }) });
      const j = await res.json(); if (j.error) throw Object.assign(new Error(j.error.message), j.error); return j.result;
    }, on() {} };
    window.addEventListener("eip6963:requestProvider", () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: { uuid: "test", name: "Test wallet", icon: "", rdns: "test" }, provider }) })));
  }, operator);
  return page;
}
const idle = (page, timeout = 60000) => page.waitForFunction(() => !document.getElementById("busyToast").classList.contains("on"), null, { timeout });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const node = spawn("npx", ["hardhat", "node", "--port", "8545"], { cwd: __dirname, stdio: "ignore", detached: true });
  const web = serveWeb();
  let browser;
  try {
    await waitRpc();
    const prov = new ethers.JsonRpcProvider(RPC);
    const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/lukso-contracts.json")));
    for (const [addr, v] of Object.entries(fixtures)) if (addr.startsWith("0x")) await prov.send("hardhat_setCode", [addr, v.code]);
    const operator = (await prov.listAccounts())[0].address;
    const [k1, k2, k3] = [0, 1, 2].map(() => ethers.Wallet.createRandom().address);
    browser = await chromium.launch();

    // ---- on-chain profile, three keys
    const page = await newPage(browser, operator);
    await page.goto(`http://127.0.0.1:${PORT}/operator.html?network=lukso-testnet&key=${k1}&name=Office%20PC`);
    await page.fill("#pName", "cantina-esempio");
    await page.fill("#pDesc", "Vino toscano");
    await page.fill("#pTags", "vino, Toscana");
    await page.fill("#pLinks", "Sito | https://www.esempio.it");
    const png = Buffer.from(await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 400; c.height = 300; const x = c.getContext("2d"); x.fillStyle = "#c33"; x.fillRect(0, 0, 400, 300); return c.toDataURL("image/png").split(",")[1]; }), "base64");
    const pngPath = path.join(OUT, "avatar.png"); fs.writeFileSync(pngPath, png);
    await page.setInputFiles("#pAvatar", pngPath);
    await page.click("#addCtrl"); await page.click("#addCtrl");
    const rows = page.locator(".ctrl-row");
    await rows.nth(1).locator(".c-addr").fill(k2); await rows.nth(1).locator(".c-role").selectOption("admin");
    await rows.nth(2).locator(".c-addr").fill(k3); await rows.nth(2).locator(".c-role").selectOption("device");
    await page.click("#connectBtn"); await idle(page);
    await page.click("#previewBtn"); await idle(page);
    const preview = await page.textContent("#previewStatus");
    const up = (preview.match(/0x[0-9a-fA-F]{40}/g) || [])[0], km = (preview.match(/0x[0-9a-fA-F]{40}/g) || [])[1];
    check(!!up && !!km, "prepare computes the UP and Key Manager addresses");
    await page.check("#ackCreate");
    await page.click("#createBtn"); await page.waitForTimeout(300); await idle(page);
    const log = await page.innerText("#log");
    check(/✅ (Check passed|Controllo superato)/.test(log), "the page's check after creation passes" + (/✅ (Check passed|Controllo superato)/.test(log) ? "" : "\n" + log));
    check((await prov.getCode(up)) !== "0x", "the UP has code");

    // ---- the permissions on the new UP
    const upI = new ethers.Interface(["function setData(bytes32,bytes)"]);
    const kmI = new ethers.Interface(["function execute(bytes) payable returns (bytes)"]);
    const LSP3 = "0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5";
    const permKey = () => "0x4b80742de2bf82acb3630000" + ethers.Wallet.createRandom().address.slice(2).toLowerCase();
    const as = async (who, key, val) => {
      await prov.send("hardhat_impersonateAccount", [who]); await prov.send("hardhat_setBalance", [who, "0x1000000000000000000"]);
      try { await (await new ethers.JsonRpcSigner(prov, who).sendTransaction({ to: km, data: kmI.encodeFunctionData("execute", [upI.encodeFunctionData("setData", [key, val])]) })).wait(); return true; } catch (e) { return false; }
    };
    check(!(await as(k3, LSP3, "0x1234")), "a device key cannot change the profile (LSP3Profile)");
    check(await as(k3, "0x344e172b69e28979f8df0000" + k3.slice(2).toLowerCase(), ethers.hexlify(ethers.toUtf8Bytes("Telefono"))), "a device key can change its own name on the account");
    check(!(await as(k3, permKey(), ethers.zeroPadValue("0x7f3f06", 32))), "a device key cannot add a controller");
    check(await as(k2, permKey(), ethers.zeroPadValue("0x200000", 32)), "an administrator can add a controller");

    // ---- LYX to the keys, the request file
    await page.fill("#fundAmount", "0.25"); await page.click("#fundBtn"); await page.waitForTimeout(300); await idle(page);
    check((await prov.getBalance(k1)) === ethers.parseEther("0.25") && (await prov.getBalance(k3)) > 0n, "the LYX step funds the keys");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#saveDraft")]);
    const reqPath = path.join(OUT, "request.json"); await dl.saveAs(reqPath);
    const req = JSON.parse(fs.readFileSync(reqPath));
    check(req.kind === "chainintegrate-up-create" && req.controllers.length === 3 && !!req.images.avatar, "the request file holds profile, image and keys");
    const again = await newPage(browser, operator);
    await again.goto(`http://127.0.0.1:${PORT}/operator.html`);
    await again.setInputFiles("#draftFile", reqPath);
    await again.waitForFunction(() => document.querySelectorAll(".ctrl-row").length === 3);
    check((await again.inputValue("#pName")) === "cantina-esempio" && (await again.inputValue("#pLinks")) === "Sito | https://www.esempio.it/" &&
      (await again.locator(".ctrl-row").nth(2).locator(".c-role").inputValue()) === "device" && (await again.locator("#avatarPrev img").count()) === 1,
      "a saved request loads back into the page");
    await again.close();
    await page.screenshot({ path: path.join(OUT, "desktop.png"), fullPage: true });

    // ---- the client's page: no crypto words, in either language
    const client = await newPage(browser, operator);
    // opened from an invitation link: the code after "#" (never sent to the server), shown with "Copy"
    await client.goto(`http://127.0.0.1:${PORT}/index.html#invito=abcd-efgh-jk2n`);
    check(await client.isVisible("#invitePanel") && (await client.textContent("#inviteCode")) === "ABCD-EFGH-JK2N", "an invitation link shows its code on the client's page");
    const BANNED = /\b(blockchain|block chain|cripto\w*|crypto\w*|wallet|token\w*|gas|lyx\w*|lukso|ethereum|ether|eth|bitcoin|btc|nft\w*|ipfs|universal profile|up|web3|smart contract|chiav[ei] privat[ae]|private key|seed|mining|minare|transazion[ei]|transactions?|on-?chain|dapp|ledger|metamask)\b/i;
    for (const lang of ["it", "en"]) {
      if ((await client.evaluate(() => document.documentElement.lang)) !== lang) await client.click("#langToggle");
      await client.evaluate(() => document.querySelectorAll("details").forEach((d) => { d.open = true; }));
      const words = await client.evaluate(() => [document.title, document.body.innerText,
        ...[...document.querySelectorAll("meta[name=description], meta[property^=og]")].map((m) => m.content)].join("\n"));
      const hit = words.match(BANNED);
      check(!hit, `the client's page in ${lang} has no crypto term${hit ? ` (found "${hit[0]}")` : ""}`);
      check(/backup/i.test(words) && /(ChainIntegrate)/.test(words), `the client's page in ${lang} explains the backup copy`);
    }
    for (const bad of ["#invito=<b>x</b>", "#invito=ABCD-EFGH", "#other=ABCD-EFGH-JKMN", ""]) {
      await client.goto(`http://127.0.0.1:${PORT}/index.html?x=${Math.random()}${bad}`);
      check(!(await client.isVisible("#invitePanel")), `no invitation panel without a valid code (${bad || "no link"})`);
    }
    await client.close();

    // ---- the privacy notice: both languages, the link from the client's page
    const pv = await newPage(browser, operator);
    await pv.goto(`http://127.0.0.1:${PORT}/privacy.html`);
    const pvIt = await pv.textContent("body");
    await pv.click("#langToggle");
    const pvEn = await pv.textContent("body");
    check(/titolare/.test(pvIt + pvEn) || /Chi è il titolare/.test(pvIt), "the privacy notice shows its sections");
    check(/info@chainintegrate\.it/.test(pvIt) && /GDPR/.test(pvEn) && pvIt !== pvEn, "the privacy notice is in Italian and English, with contacts and rights");
    await pv.close();

    // ---- IPFS mode, phone width
    const phone = await newPage(browser, operator, { viewport: { width: 390, height: 900 } });
    let uploads = 0;
    await phone.route("https://ipfs.chainintegrate.it/api/v0/add**", (r) => { uploads++; r.fulfill({ status: 200, body: JSON.stringify({ Name: "f", Hash: "bafybeigdyrztktx5b5m2y4sogf2hf5uq3k5knv5c5k2pvx7aq5ekhtest0" + uploads, Size: "1" }) + "\n", headers: { "content-type": "application/json", "access-control-allow-origin": "*" } }); });
    await phone.goto(`http://127.0.0.1:${PORT}/operator.html?network=lukso-testnet&key=${ethers.Wallet.createRandom().address}`);
    await phone.fill("#pName", "mario-rossi");
    await phone.setInputFiles("#pAvatar", pngPath);
    await phone.check("#storeIpfs"); await phone.fill("#ipfsApi", "https://ipfs.chainintegrate.it"); await phone.dispatchEvent("#ipfsApi", "change");
    await phone.click("#previewBtn"); await idle(phone);
    check(/ipfs:\/\/bafybei\w+test02/.test(await phone.textContent("#previewStatus")) && uploads === 2, "IPFS mode uploads the image and the JSON");
    check(!(await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), "no horizontal scroll at phone width");
    await phone.click("#langToggle");
    check((await phone.textContent("h1")).length > 0 && (await phone.evaluate(() => document.documentElement.lang)) !== "", "the language toggle works");
    await phone.screenshot({ path: path.join(OUT, "phone.png"), fullPage: true });
  } finally {
    if (browser) await browser.close();
    web.close(); try { process.kill(-node.pid); } catch (e) { node.kill(); } // npx and the node it starts
  }
  console.log(failures ? `${failures} check(s) failed` : "all checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
