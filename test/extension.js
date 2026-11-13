// End-to-end test of the extension (extension/), loaded in Chromium.
//
// - setup with a password: the backup is downloaded, a wrong password and another access's backup are refused,
//   the right one is accepted, and only then the access is stored (encrypted: the key never in clear);
// - removal and restore from the backup on a "new computer": the same code comes back;
// - setup with the computer's lock (a virtual authenticator with PRF), then a new backup copy unlocked with it;
// - no crypto term on any screen, in Italian or English.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const { ethers } = require("ethers");
const K = require("../shared/keystore.js");
const UPRequest = require("../shared/request.js");
const UPRelay = require("../shared/relay.js");

const EXT = path.join(__dirname, "..", "extension");
const OUT = path.join(__dirname, "out");
const PW = "una password lunga 1", BK = "backup password lunga 2";
const BANNED = /\b(blockchain|block chain|cripto\w*|crypto\w*|wallet|token\w*|gas|lyx\w*|lukso|ethereum|ether|eth|bitcoin|btc|nft\w*|ipfs|universal profile|up|web3|smart contract|chiav[ei] privat[ae]|private key|seed|mining|minare|transazion[ei]|transactions?|on-?chain|dapp|ledger|metamask)\b/i;
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? "ok  " : "FAIL"} ${label}`); if (!ok) failures++; };

// The ID fixed by the manifest's key: the first 32 hex digits of SHA-256(public key), written with a-p.
const EXPECTED_ID = [...require("crypto").createHash("sha256").update(Buffer.from(JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"))).key, "base64")).digest("hex").slice(0, 32)]
  .map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");

async function launch(health, extDir = EXT, profile = null, sums = null) {
  const dir = profile || fs.mkdtempSync(path.join(os.tmpdir(), "ci-ext-"));
  const ctx = await chromium.launchPersistentContext(dir, { channel: "chromium", headless: true, acceptDownloads: true,
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`] });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker");
  const id = new URL(sw.url()).host;
  if (sums) await ctx.route("https://account.chainintegrate.it/extension/**", (r) => r.fulfill({ status: 200, contentType: "text/plain", body: sums }));
  if (health) await ctx.route("https://account.chainintegrate.it/api/health", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(health) }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => check(false, "page error: " + e.message));
  await page.goto(`chrome-extension://${id}/app.html?lang=it`);
  await page.waitForSelector(".screen:not([hidden])");
  return { ctx, page, id, dir };
}
const visible = (page, id) => page.waitForSelector(`#${id}:not([hidden])`, { timeout: 30000 });
const msg = (page, id) => page.textContent(`#${id}`);
async function downloadBackup(page, name) {
  await page.fill("#bkPw", BK); await page.fill("#bkPw2", BK);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#backupBtn")]);
  const file = path.join(OUT, name); await dl.saveAs(file);
  await visible(page, "sVerify");
  return file;
}
async function verify(page, file, pw) {
  await page.setInputFiles("#verifyFile", file); await page.fill("#verifyPw", pw);
  await page.click("#verifyBtn");
  await page.waitForFunction(() => !document.querySelector("#verifyBtn").disabled);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // ---- 0. the ID does not depend on the folder; an access survives an update into another folder
  {
    const copy = fs.mkdtempSync(path.join(os.tmpdir(), "ci-ext-copy-"));
    fs.cpSync(EXT, copy, { recursive: true });
    let r = await launch(null, copy);
    check(r.id === EXPECTED_ID, `the extension's ID is fixed by its key (${r.id})`);
    await r.page.evaluate(() => chrome.storage.local.set({ account: { probe: true } }));
    await r.ctx.close();
    r = await launch(null, EXT, r.dir); // same browser profile, the extension from another folder (an update)
    check(r.id === EXPECTED_ID && (await r.page.evaluate(() => chrome.storage.local.get("account"))).account.probe === true, "what the extension keeps survives loading it from another folder");
    await r.page.evaluate(() => chrome.storage.local.remove("account"));
    await r.ctx.close();
  }

  // ---- integrity: the extension checks its own files against the published SHA-256 (EXT-06)
  {
    const crypto = require("crypto");
    const walk = (d, b = "") => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name), b + e.name + "/") : [b + e.name]));
    const good = walk(EXT).filter((f) => /\.(js|html|json)$/.test(f)).map((f) => `${crypto.createHash("sha256").update(fs.readFileSync(path.join(EXT, f))).digest("hex")}  chainintegrate-account/${f}`).join("\n") + "\n";
    let r = await launch(null, EXT, null, good);
    await r.page.waitForTimeout(800);
    await r.page.click("#startNew");
    check(await r.page.isVisible("#sProtect") && !(await r.page.isVisible("#integrityBox")), "integrity: the published files let the extension work");
    await r.ctx.close();
    const bad = good.replace(/^[0-9a-f]{64}(  chainintegrate-account\/passkey\.js)$/m, "0".repeat(64) + "$1");
    r = await launch(null, EXT, null, bad);
    await r.page.click("#startRestore");
    await visible(r.page, "integrityBox");
    check(!(await r.page.isVisible("#sRestore")) && /passkey\.js/.test(await r.page.textContent("#integrityFiles")), "integrity: a modified file is named and the access is not unlocked (restore refused)");
    await r.page.click("#startNew");
    check(!(await r.page.isVisible("#sProtect")), "integrity: a new access is refused too");
    await r.ctx.close();
  }

  // ---- 1. setup with a password
  let { ctx, page } = await launch();
  await page.waitForSelector("#sWelcome:not([hidden])");
  for (const lang of ["it", "en"]) {
    if ((await page.evaluate(() => document.documentElement.lang)) !== lang) await page.click("#langToggle");
    const words = await page.evaluate(() => { document.querySelectorAll(".screen, .screen .panel").forEach((s) => { s.hidden = false; }); const t = document.body.innerText + "\n" + [...document.querySelectorAll("[placeholder]")].map((e) => e.placeholder).join("\n"); document.querySelectorAll(".screen").forEach((s) => { s.hidden = s.id !== "sWelcome"; }); document.querySelectorAll(".screen .panel[id]").forEach((p) => { p.hidden = true; }); return t; });
    const manifest = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"))).description;
    const hit = (words + "\n" + manifest).match(BANNED);
    check(!hit, `the extension in ${lang} has no crypto term${hit ? ` (found "${hit[0]}")` : ""}`);
  }
  await page.click("#langToggle"); // back to Italian
  await page.click("#startNew"); await visible(page, "sProtect");
  await page.check("input[name=how][value=password]");
  await page.fill("#devPw", "corta"); await page.fill("#devPw2", "corta"); await page.click("#protectBtn");
  check(/12/.test(await msg(page, "protectMsg")), "a short password is refused");
  await page.fill("#devPw", PW); await page.fill("#devPw2", PW); await page.click("#protectBtn");
  await visible(page, "sBackup");
  check((await page.evaluate(() => chrome.storage.local.get("account"))).account === undefined, "nothing is stored before the backup is checked");
  const file1 = await downloadBackup(page, "backup-1.json");
  const bk = JSON.parse(fs.readFileSync(file1));
  check(bk.kind === K.BACKUP_KIND && bk.key.method === "password", "the backup file is a password-protected key");

  await verify(page, file1, BK + "x");
  check(/sbagliata/.test(await msg(page, "verifyMsg")), "a wrong backup password is refused");
  const other = K.backupFile(await K.sealWithPassword(K.generate().privateKey, BK));
  const otherFile = path.join(OUT, "other.json"); fs.writeFileSync(otherFile, JSON.stringify(other));
  await verify(page, otherFile, BK);
  check(/altro accesso/.test(await msg(page, "verifyMsg")), "another access's backup is refused");
  await verify(page, file1, BK);
  await visible(page, "sMain");
  const code = (await page.textContent("#code")).trim();
  check(code === bk.key.address, "the code shown is the backup's address");
  check((await page.inputValue("#cName")) === "Computer" && !(await page.isVisible("#devNameLine")), "the computer's name is in the creation form, prefilled");
  await page.fill("#cName", "PC ufficio");

  // ---- the account, created by the service (answered here: the service itself is test/creator.js)
  check(await page.isVisible("#pCreate") && !(await page.isVisible("#pAccount")), "a new access offers to create the account");
  await ctx.route("https://account.chainintegrate.it/api/health", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"network":"lukso-testnet"}' }));
  let seen = null, answer = { status: 409, body: { error: "invite_used" } };
  await ctx.route("https://account.chainintegrate.it/api/create", async (r) => {
    seen = JSON.parse(r.request().postData());
    await r.fulfill({ status: answer.status, contentType: "application/json", body: JSON.stringify(answer.body) });
  });
  // the name rule: lowercase as typed, the button off until the name is valid
  await page.fill("#invite", "ABCD-EFGH-JKMN");
  await page.type("#pName", "Rossi_Srl");
  check((await page.inputValue("#pName")) === "rossi_srl" && (await page.isDisabled("#createBtn")) && /❌/.test(await page.textContent("#nameHint")), "the name is lowercased as typed, and a name with an underscore keeps the button off");
  await page.fill("#pName", "-rossi"); await page.dispatchEvent("#pName", "input");
  check(await page.isDisabled("#createBtn"), "a name starting with a hyphen keeps the button off");
  await page.fill("#pName", "rossi-srl"); await page.dispatchEvent("#pName", "input");
  check(!(await page.isDisabled("#createBtn")) && /✅/.test(await page.textContent("#nameHint")), "a valid name turns the button on");
  await page.fill("#pDesc", "Vino toscano");
  await page.setInputFiles("#pAvatar", path.join(__dirname, "..", "web", "icon-192.png"));
  await page.waitForSelector("#avatarPrev img");
  await page.fill("#createPw", PW + "x"); await page.click("#createBtn");
  await page.waitForFunction(() => !document.querySelector("#createBtn").disabled);
  check(/sbagliata/.test(await msg(page, "createMsg")) && seen === null, "a wrong password sends nothing" + ` [${await msg(page, "createMsg")}]`);
  await page.fill("#createPw", PW); await page.click("#createBtn");
  await page.waitForFunction(() => !document.querySelector("#createBtn").disabled);
  check(/già stato usato/.test(await msg(page, "createMsg")), "the service's refusal is told in plain words");
  const req = UPRequest.parse(seen.request);
  check(req.errors.length === 0 && req.request.controllers.length === 1 && req.request.controllers[0].address === code && req.request.controllers[0].role === "admin" &&
    req.request.controllers[0].name === "PC ufficio" && req.request.profile.name === "rossi-srl" && !!req.request.images.avatar && req.request.network === "lukso-testnet",
    "the request names this computer's key as administrator, with the profile, the picture and the service's network");
  check(ethers.verifyMessage(UPRequest.signingMessage(req.request), seen.signature) === code && seen.invite === "ABCD-EFGH-JKMN", "the request is signed with this computer's key");
  check(req.request.images.avatar.dataUrl.startsWith("data:image/jpeg;"), "a picture without transparency is sent as JPEG");
  // a logo with transparent pixels stays PNG
  const logo = Buffer.from(await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 300; c.height = 300; const x = c.getContext("2d"); x.fillStyle = "#22b8c9"; x.fillRect(50, 50, 200, 200); return c.toDataURL("image/png").split(",")[1]; }), "base64");
  const logoPath = path.join(OUT, "logo-transparent.png"); fs.writeFileSync(logoPath, logo);
  await page.setInputFiles("#pAvatar", logoPath); await page.waitForSelector("#avatarPrev img");
  await page.fill("#createPw", PW); await page.click("#createBtn");
  await page.waitForFunction(() => !document.querySelector("#createBtn").disabled);
  check(UPRequest.parse(seen.request).request.images.avatar.dataUrl.startsWith("data:image/png;"), "a picture with transparent pixels is sent as PNG");
  const UP = ethers.Wallet.createRandom().address;
  answer = { status: 200, body: { up: UP, km: ethers.Wallet.createRandom().address, tx: "0x" + "ab".repeat(32), network: "lukso" } };
  await page.fill("#createPw", PW); await page.click("#createBtn");
  // the required backup copy that names the account, right after the creation
  await visible(page, "sBackup");
  check(await page.isVisible("#backupAccountNote"), "after the creation a new backup copy is required, and the screen says why");
  const fileAcc = await downloadBackup(page, "backup-account.json");
  check(K.readBackupInfo(JSON.parse(fs.readFileSync(fileAcc))).account.address === UP, "the new backup copy names the account");
  await verify(page, file1, BK);
  check(/senza il tuo account/.test(await msg(page, "verifyMsg")) && !(await page.isVisible("#sMain")), "the earlier copy (without the account) is not accepted as the account's backup");
  await verify(page, fileAcc, BK);
  await visible(page, "pAccount");
  const acc = (await page.evaluate(() => chrome.storage.local.get("account"))).account;
  check(acc.backupHasAccount === true && (await page.textContent("#accountAddr")).trim() === UP, "then the account is ready, its address shown");
  check(acc.nameInAccount === "PC ufficio" && (await page.isVisible("#devNameLine")) && /PC ufficio/.test(await page.textContent("#devNameLine")), "after the creation the computer's name written in the account is shown");
  check(acc.up === UP && acc.profileName === "rossi-srl" && /^data:image\//.test(acc.picture) && !(await page.isVisible("#pCreate")), "the created account is shown and remembered");
  check((await page.getAttribute("#profileLink", "href")).endsWith(UP), "the public profile link points to the account");
  check((await page.inputValue("#pAvatar")) === "" && (await page.inputValue("#pName")) === "", "after the creation the form is empty, the picture field too (the same file can be chosen again)");

  // ---- changes to the account over the relay (the service answered here; the service itself: test/creator.js)
  const KMADDR = ethers.Wallet.createRandom().address;
  const sent = [];
  await ctx.route("https://account.chainintegrate.it/api/relay/nonce", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ account: UP, keyManager: KMADDR, nonce: "7", chainId: 42, time: Math.floor(Date.now() / 1000) - 12 }) }));
  await ctx.route("https://account.chainintegrate.it/api/relay", (r) => { sent.push(["relay", JSON.parse(r.request().postData())]); r.fulfill({ status: 200, contentType: "application/json", body: '{"tx":"0x01"}' }); });
  await ctx.route("https://account.chainintegrate.it/api/profile", (r) => { sent.push(["profile", JSON.parse(r.request().postData())]); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value: "0x00006f357c6a0020" + "11".repeat(32) + Buffer.from("ipfs://bafkreigdyrztktx5b5m2y4sogf2hf5uq3k5knv5c5k2pvx7aq5ekhtest01").toString("hex"), url: "ipfs://x" }) }); });
  await page.click("#editBox summary");
  check((await page.inputValue("#eName")) === "rossi-srl" && (await page.inputValue("#eDesc")) === "Vino toscano" && (await page.inputValue("#rName")) === "PC ufficio", "the edit form is prefilled with the account's profile and this computer's name");
  await page.fill("#rName", "Portatile Simone"); await page.fill("#editPw", PW); await page.click("#rNameBtn");
  await page.waitForFunction(() => /✅/.test(document.querySelector("#editMsg").textContent), null, { timeout: 30000 });
  const rel = sent.find((x) => x[0] === "relay")[1];
  const relDigest = UPRelay.digest({ chainId: 42, keyManager: KMADDR, nonce: 7n, validity: BigInt(rel.validity), payload: rel.payload });
  check(ethers.recoverAddress(relDigest, rel.signature) === code && UPRelay.check(rel.payload, { signer: code }).items[0].name === "Portatile Simone" && rel.account === UP,
    "renaming this computer: the LSP25 request is signed by this computer's key for the account's Key Manager");
  const relV = UPRelay.splitValidity(BigInt(rel.validity));
  check(relV.start === 0n && Math.abs(Number(relV.end) - (Math.floor(Date.now() / 1000) - 12 + 600)) < 30, "the request is valid from the start until ten minutes after the network's time given by the service (not the computer's clock)");
  check((await page.evaluate(() => chrome.storage.local.get("account"))).account.nameInAccount === "Portatile Simone", "the new name is remembered");
  sent.length = 0;
  await page.fill("#eDesc", "Vino toscano, dal 1950"); await page.fill("#editPw", PW); await page.click("#eProfileBtn");
  await page.waitForFunction(() => /Profilo aggiornato/.test(document.querySelector("#editMsg").textContent), null, { timeout: 30000 });
  const prof = sent.find((x) => x[0] === "profile")[1];
  check(ethers.verifyMessage(UPRequest.updateMessage(prof.update), prof.signature) === code && prof.update.profile.description === "Vino toscano, dal 1950" && prof.update.keepPicture === true,
    "updating the profile: the request to store it is signed by this computer's key; no new picture keeps the current one");
  const rel2 = sent.find((x) => x[0] === "relay")[1];
  check(UPRelay.check(rel2.payload, { signer: code }).items[0].op === "profile", "then the new profile is written with the relay");
  // ---- a project's page (provider.js, bridge.js, background.js, confirm.js); the network and the service answered here
  const REG = ethers.Wallet.createRandom().address, NOTREG = ethers.Wallet.createRandom().address;
  const PROJ = "https://traceability.chainintegrate.it";
  const SITE_HTML = "<!doctype html><title>project</title><script>window.got = []; window.addEventListener('eip6963:announceProvider', (e) => window.got.push(e.detail)); window.dispatchEvent(new Event('eip6963:requestProvider'));</script>";
  await ctx.route(PROJ + "/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: SITE_HTML }));
  await ctx.route("https://other.chainintegrate.it/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: SITE_HTML }));
  const IS_REG = new ethers.Interface(["function isRegistry(address) view returns (bool)"]);
  // The network: ChainIntegrate's node through the service (/api/rpc), LUKSO's public node as the fallback.
  const rpcSeen = { service: 0, lukso: 0 };
  let serviceDown = false;
  const answerRpc = (who) => (r) => {
    rpcSeen[who]++;
    if (who === "service" && serviceDown) return r.fulfill({ status: 503, contentType: "application/json", body: '{"error":"upstream"}' });
    const q = JSON.parse(r.request().postData());
    let result = who === "service" ? "0x10" : "0x11";
    if (q.method === "eth_call") { const a = IS_REG.decodeFunctionData("isRegistry", q.params[0].data)[0]; result = ethers.zeroPadValue(a === REG ? "0x01" : "0x00", 32); }
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: q.id, result }) });
  };
  await ctx.route("https://account.chainintegrate.it/api/rpc", answerRpc("service"));
  await ctx.route("https://rpc.mainnet.lukso.network/**", answerRpc("lukso"));
  const site = await ctx.newPage();
  site.on("pageerror", (e) => check(false, "site page error: " + e.message));
  await site.goto(PROJ + "/app.html");
  await site.waitForFunction(() => window.got.length > 0, null, { timeout: 10000 });
  check(await site.evaluate(() => window.got[0].info.name === "ChainIntegrate Account" && window.got[0].info.rdns === "it.chainintegrate.account" && /^data:image\/png;base64,/.test(window.got[0].info.icon) && !window.ethereum && !window.lukso),
    "a project's page finds the extension with EIP-6963 (and nothing is set as window.ethereum or window.lukso)");
  const ask = (method, params) => site.evaluate(([m, p]) => window.got[0].provider.request({ method: m, params: p }).then((r) => ({ r }), (e) => ({ e: { code: e.code, message: e.message } })), [method, params]);
  check((await ask("eth_chainId", [])).r === "0x2a" && (await ask("eth_blockNumber", [])).r === "0x10" && rpcSeen.lukso === 0, "the page reads the network through the extension, from ChainIntegrate's node");
  serviceDown = true;
  check((await ask("eth_blockNumber", [])).r === "0x11", "when ChainIntegrate's node does not answer, LUKSO's public node does");
  serviceDown = false;
  check((await ask("eth_accounts", [])).r.length === 0 && (await ask("personal_sign", ["0x01", UP])).e.code === 4100, "before connecting, no address and no signature");
  // connect: the confirmation window, Cancel focused
  let pop = ctx.waitForEvent("page");
  let pending = ask("eth_requestAccounts", []);
  let w = await pop; await w.waitForSelector("#ok:not([hidden])");
  check((await w.evaluate(() => document.activeElement.id)) === "cancel" && /traceability\.chainintegrate\.it/.test(await w.textContent("#site")), "connecting opens the extension's window, naming the site, with Cancel focused");
  await w.click("#ok");
  check(JSON.stringify((await pending).r) === JSON.stringify([UP]) && JSON.stringify((await ask("eth_accounts", [])).r) === JSON.stringify([UP]), "once connected the site sees the account's address");
  // a sign-in message of the project
  const siwe = "traceability.chainintegrate.it wants you to sign in with your Ethereum account:\n" + UP + "\n\n" +
    "[IT] Firma di conferma dalla tua Universal Profile: non si tratta di un pagamento, non costa nulla e non scrive niente sulla blockchain. Serve solo a dimostrare che sei davvero tu a chiedere questa operazione. [EN] Confirmation signature from your Universal Profile: it is not a payment, costs nothing and writes nothing on the blockchain. It only proves it's really you asking for this. [Operazione / Operation: Caricamento documento / Upload document]\n\n" +
    "URI: " + PROJ + "\nVersion: 1\nChain ID: 42\nNonce: " + "cd".repeat(32) + "\nIssued At: " + new Date().toISOString() + "\nResources:\n- " + PROJ + "/how-it-works.html";
  pop = ctx.waitForEvent("page");
  pending = ask("personal_sign", [ethers.hexlify(ethers.toUtf8Bytes(siwe)), UP]);
  w = await pop; await w.waitForSelector("#ok:not([hidden])");
  check(/caricare un documento/.test(await w.textContent("#what")) && await w.isVisible("#pw"), "a sign-in message is shown in plain words, with the password field");
  await w.fill("#pw", PW); await w.click("#ok");
  const sig = (await pending).r;
  check(!!sig && ethers.recoverAddress(ethers.hashMessage(siwe), sig) === code, "the message is signed with this computer's key");
  const before = ctx.pages().length;
  check((await ask("personal_sign", [ethers.hexlify(ethers.toUtf8Bytes("Sign this to win")), UP])).e.code === 4100 && ctx.pages().length === before, "a message outside the catalog is refused, without a window");
  // an operation, sent through the service
  const TR = new ethers.Interface(["function mintRawMaterialLotBatch(bytes32[],bytes[],uint256[])"]);
  const lots = TR.encodeFunctionData("mintRawMaterialLotBatch", [[ethers.ZeroHash, ethers.id("2")], ["0x", "0x"], [1, 2]]);
  sent.length = 0;
  pop = ctx.waitForEvent("page");
  pending = ask("eth_sendTransaction", [{ from: UP, to: REG, data: lots }]);
  w = await pop; await w.waitForSelector("#ok:not([hidden])");
  check(/2 lotti di materia prima/.test(await w.textContent("#what")) && /ChainIntegrate/.test(await w.textContent("#note")), "an operation is described from its own data, and says who pays");
  await w.fill("#pw", PW); await w.click("#ok");
  check((await pending).r === "0x01", "the page receives the operation's reference");
  const op = sent.find((x) => x[0] === "relay")[1];
  const opDigest = UPRelay.digest({ chainId: 42, keyManager: KMADDR, nonce: 7n, validity: BigInt(op.validity), payload: op.payload });
  const opCheck = UPRelay.check(op.payload, { signer: code, chainId: 42 });
  check(ethers.recoverAddress(opDigest, op.signature) === code && opCheck.ok && opCheck.items[0].project === "traceability" && opCheck.items[0].target === REG, "the operation is the account's call to the registry, signed by this computer's key");
  // a registry the project did not create: refused in the window
  pop = ctx.waitForEvent("page");
  pending = ask("eth_sendTransaction", [{ from: UP, to: NOTREG, data: lots }]);
  w = await pop; await w.waitForSelector("#ok:not([hidden])");
  await w.fill("#pw", PW); await w.click("#ok");
  check((await pending).e.code === 4100 && /non risulta/.test(await w.textContent("#msg")) && rpcSeen.lukso === 1, "a registry not created by the project's factory is refused (checked on ChainIntegrate's node)");
  await w.close();
  // cancel
  pop = ctx.waitForEvent("page");
  pending = ask("eth_sendTransaction", [{ from: UP, to: REG, data: lots }]);
  w = await pop; await w.waitForSelector("#ok:not([hidden])");
  await w.click("#cancel");
  check((await pending).e.code === 4001, "Cancel answers the page that the request was cancelled");
  pop = ctx.waitForEvent("page");
  pending = ask("eth_sendTransaction", [{ from: UP, to: REG, data: lots }]);
  w = await pop; await w.waitForSelector("#ok:not([hidden])");
  await w.close();
  check((await pending).e.code === 4001, "closing the window cancels too");
  const admin = new ethers.Interface(["function setRegistryAdmin(address)"]).encodeFunctionData("setRegistryAdmin", [UP]);
  check((await ask("eth_sendTransaction", [{ from: UP, to: REG, data: admin }])).e.code === 4100, "ChainIntegrate's administration is refused, without a window");
  // a subdomain that is not a project
  const otherSite = await ctx.newPage();
  await otherSite.goto("https://other.chainintegrate.it/");
  await otherSite.waitForTimeout(800);
  check(await otherSite.evaluate(() => window.got.length === 0), "on a subdomain that is not a project the extension does not announce itself");
  await otherSite.close();
  // the site listed in the extension's page, and disconnected from there
  await page.reload(); await visible(page, "sitesBox");
  check(/traceability\.chainintegrate\.it/.test(await page.textContent("#sitesList")), "the extension's page lists the connected site");
  await page.click("#sitesList button");
  await page.waitForFunction(() => /Nessun sito/.test(document.querySelector("#sitesList").textContent));
  check((await ask("eth_accounts", [])).r.length === 0, "disconnected, the site no longer sees the address");
  await site.close();

  await ctx.unroute("https://account.chainintegrate.it/api/create");
  const stored = (await page.evaluate(() => chrome.storage.local.get("account"))).account;
  const clear = ethers.hexlify(await K.open(bk.key, { password: BK })).slice(2);
  check(stored.record.address === code && stored.record.method === "password" && !JSON.stringify(stored).includes(clear), "the stored access is encrypted and holds no clear key");
  check(ethers.hexlify(await K.open(stored.record, { password: PW })).slice(2) === clear, "the stored access opens with the computer's password");

  // a new backup copy, unlocked with the password
  await page.click("#newBackup"); await page.fill("#unlockPw", PW + "x"); await page.click("#unlockBtn");
  await page.waitForFunction(() => /sbagliata/.test(document.querySelector("#mainMsg").textContent));
  check(true, "a wrong computer password is refused");
  await page.fill("#unlockPw", PW); await page.click("#unlockBtn"); await visible(page, "sBackup");
  const file2 = await downloadBackup(page, "backup-2.json");
  await verify(page, file2, BK); await visible(page, "sMain");
  check(/funziona/.test(await msg(page, "mainMsg")), "a new backup copy is made and checked");

  // remove
  check(await page.isDisabled("#removeBtn"), "removal needs the checkbox");
  await page.check("#removeAck"); await page.click("#removeBtn");
  await visible(page, "removeConfirm");
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  check(focused === "removeCancel" && (await page.evaluate(() => chrome.storage.local.get("account"))).account !== undefined && /rossi-srl/.test(await page.textContent("#removeConfirmText")),
    "removal asks for a confirmation that names the account, with Cancel focused, and removes nothing yet");
  await page.click("#removeCancel");
  check(!(await page.isVisible("#removeConfirm")) && (await page.isDisabled("#removeBtn")) && (await page.evaluate(() => chrome.storage.local.get("account"))).account !== undefined, "Cancel keeps the access");
  await page.check("#removeAck"); await page.click("#removeBtn"); await visible(page, "removeConfirm");
  await page.click("#removeYes"); await visible(page, "sWelcome");
  check((await page.evaluate(() => chrome.storage.local.get("account"))).account === undefined, "removal deletes the stored access");
  await ctx.close();

  // ---- 2. restore on a new computer
  ({ ctx, page } = await launch({ ok: true, network: "lukso", extension: { version: "9.9.9", download: "https://github.com/ChainIntegrate/up-onboarding/releases/latest" } }));
  await visible(page, "updateBox");
  check(/9\.9\.9/.test(await page.textContent("#updateText")) && (await page.getAttribute("#updateLink", "href")).startsWith("https://github.com/ChainIntegrate/"), "a newer version is announced, with the download link");
  const FOUND = ethers.Wallet.createRandom().address;
  let asked = null;
  await ctx.route("https://account.chainintegrate.it/api/lookup", async (r) => { asked = JSON.parse(r.request().postData()).address; await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ up: FOUND, network: "lukso" }) }); });
  await page.click("#startRestore"); await visible(page, "sRestore");
  await page.setInputFiles("#restoreFile", file1); await page.fill("#restorePw", "sbagliata davvero");
  await page.click("#restoreBtn"); await page.waitForFunction(() => /sbagliata/.test(document.querySelector("#restoreMsg").textContent));
  check(true, "restore refuses a wrong password");
  await page.fill("#restorePw", BK); await page.click("#restoreBtn"); await visible(page, "sProtect");
  await page.check("input[name=how][value=password]"); await page.fill("#devPw", PW); await page.fill("#devPw2", PW);
  await page.click("#protectBtn");
  await visible(page, "sNeedBackup");
  check(asked === code && (await page.evaluate(() => chrome.storage.local.get("account"))).account.up === FOUND,
    "restoring an earlier copy (without the account): the service finds the account by its key");
  check(!(await page.isVisible("#sMain")), "and a backup copy naming the account is required before anything else");
  await ctx.close();

  // ---- 2b. restore from the copy that names the account, with the service unreachable
  ({ ctx, page } = await launch());
  await ctx.route("https://account.chainintegrate.it/api/lookup", (r) => r.abort());
  // The profile and this computer's name, read back from the account through the service (the backup has neither).
  const PIC = "bafkreidnnxnralgvfzodayh6my4dm4ztudkqktimor76hinwb2p4pt2dbi";
  let readAsked = null;
  await ctx.route("https://account.chainintegrate.it/api/profile/read", (r) => { readAsked = JSON.parse(r.request().postData()); r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ account: UP, name: "rossi-srl", description: "Vino toscano, dal 1950", picture: "ipfs://" + PIC, deviceName: "Portatile Simone" }) }); });
  await ctx.route("https://api.universalprofile.cloud/ipfs/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: fs.readFileSync(path.join(__dirname, "..", "web", "icon-192.png")) }));
  await page.click("#startRestore"); await visible(page, "sRestore");
  await page.setInputFiles("#restoreFile", fileAcc); await page.fill("#restorePw", BK); await page.click("#restoreBtn"); await visible(page, "sProtect");
  await page.check("input[name=how][value=password]"); await page.fill("#devPw", PW); await page.fill("#devPw2", PW);
  await page.click("#protectBtn"); await visible(page, "pAccount");
  check((await page.textContent("#code")).trim() === code && (await page.textContent("#accountAddr")).trim() === UP, "restoring the copy that names the account finds it from the file, without the service");
  await page.waitForFunction(() => /rossi-srl/.test(document.querySelector("#accountCard").textContent), null, { timeout: 10000 });
  await page.click("#editBox summary");
  check(readAsked && readAsked.account === UP && readAsked.signer === code && (await page.inputValue("#eName")) === "rossi-srl" && (await page.inputValue("#eDesc")) === "Vino toscano, dal 1950" &&
    (await page.inputValue("#rName")) === "Portatile Simone" && (await page.getAttribute("#accountCard img", "src")) === "https://api.universalprofile.cloud/ipfs/" + PIC,
    "after a restore the profile (name, description, picture) and this computer's name are read back from the account");
  await ctx.close();

  // ---- 3. setup with the computer's lock (virtual authenticator with PRF)
  const own = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"))).version;
  ({ ctx, page } = await launch({ ok: true, network: "lukso", extension: { version: own, download: "https://github.com/ChainIntegrate/up-onboarding/releases/latest" } }));
  await page.waitForTimeout(500);
  check(!(await page.isVisible("#updateBox")), "no update notice when the version is the latest");
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true }); // headless pages have no focus, which WebAuthn requires
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", ctap2Version: "ctap2_1", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true } });
  await page.bringToFront();
  await page.click("#startNew"); await visible(page, "sProtect");
  await page.click("#protectBtn");
  await Promise.race([visible(page, "sBackup"), page.waitForFunction(() => document.querySelector("#protectMsg").textContent.length > 0 && !document.querySelector("#protectBtn").disabled)]);
  if (!(await page.isVisible("#sBackup"))) {
    check(false, "setup with the computer's lock: " + (await msg(page, "protectMsg")));
  } else {
    const file3 = await downloadBackup(page, "backup-3.json");
    await verify(page, file3, BK); await visible(page, "sMain");
    const rec = (await page.evaluate(() => chrome.storage.local.get("account"))).account.record;
    check(rec.method === "secret" && rec.meta && rec.meta.credId, "setup with the computer's lock stores a passkey-protected access");
    await page.click("#newBackup"); await visible(page, "sBackup");
    const file4 = await downloadBackup(page, "backup-4.json");
    await verify(page, file4, BK); await visible(page, "sMain");
    check(JSON.parse(fs.readFileSync(file4)).key.address === rec.address, "the computer's lock unlocks the access for a new backup copy");
  }
  await page.screenshot({ path: path.join(OUT, "extension.png"), fullPage: true });
  await ctx.close();

  console.log(failures ? `${failures} check(s) failed` : "all checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
