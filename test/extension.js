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
  await visible(page, "pAccount");
  const acc = (await page.evaluate(() => chrome.storage.local.get("account"))).account;
  check(acc.nameInAccount === "PC ufficio" && (await page.isVisible("#devNameLine")) && /PC ufficio/.test(await page.textContent("#devNameLine")), "after the creation the computer's name written in the account is shown");
  check(acc.up === UP && acc.profileName === "rossi-srl" && /^data:image\//.test(acc.picture) && !(await page.isVisible("#pCreate")), "the created account is shown and remembered");
  check((await page.getAttribute("#profileLink", "href")).endsWith(UP), "the public profile link points to the account");
  check((await page.inputValue("#pAvatar")) === "" && (await page.inputValue("#pName")) === "", "after the creation the form is empty, the picture field too (the same file can be chosen again)");
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
  await page.click("#protectBtn"); await visible(page, "sMain");
  check((await page.textContent("#code")).trim() === code, "the restored access has the same code");
  await visible(page, "pAccount");
  check(asked === code && (await page.evaluate(() => chrome.storage.local.get("account"))).account.up === FOUND, "after a restore the account is found again by its key");
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
