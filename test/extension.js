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

const EXT = path.join(__dirname, "..", "extension");
const OUT = path.join(__dirname, "out");
const PW = "una password lunga 1", BK = "backup password lunga 2";
const BANNED = /\b(blockchain|block chain|cripto\w*|crypto\w*|wallet|token\w*|gas|lyx\w*|lukso|ethereum|ether|eth|bitcoin|btc|nft\w*|ipfs|universal profile|up|web3|smart contract|chiav[ei] privat[ae]|private key|seed|mining|minare|transazion[ei]|transactions?|on-?chain|dapp|ledger|metamask)\b/i;
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? "ok  " : "FAIL"} ${label}`); if (!ok) failures++; };

async function launch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ci-ext-"));
  const ctx = await chromium.launchPersistentContext(dir, { channel: "chromium", headless: true, acceptDownloads: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker");
  const id = new URL(sw.url()).host;
  const page = await ctx.newPage();
  page.on("pageerror", (e) => check(false, "page error: " + e.message));
  await page.goto(`chrome-extension://${id}/app.html?lang=it`);
  await page.waitForSelector("#sWelcome:not([hidden])");
  return { ctx, page };
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

  // ---- 1. setup with a password
  let { ctx, page } = await launch();
  for (const lang of ["it", "en"]) {
    if ((await page.evaluate(() => document.documentElement.lang)) !== lang) await page.click("#langToggle");
    const words = await page.evaluate(() => { document.querySelectorAll(".screen").forEach((s) => { s.hidden = false; }); const t = document.body.innerText + "\n" + [...document.querySelectorAll("[placeholder]")].map((e) => e.placeholder).join("\n"); document.querySelectorAll(".screen").forEach((s) => { s.hidden = s.id !== "sWelcome"; }); return t; });
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
  check(await page.isDisabled("#removeBtn"), "removal needs the confirmation");
  await page.check("#removeAck"); await page.click("#removeBtn"); await visible(page, "sWelcome");
  check((await page.evaluate(() => chrome.storage.local.get("account"))).account === undefined, "removal deletes the stored access");
  await ctx.close();

  // ---- 2. restore on a new computer
  ({ ctx, page } = await launch());
  await page.click("#startRestore"); await visible(page, "sRestore");
  await page.setInputFiles("#restoreFile", file1); await page.fill("#restorePw", "sbagliata davvero");
  await page.click("#restoreBtn"); await page.waitForFunction(() => /sbagliata/.test(document.querySelector("#restoreMsg").textContent));
  check(true, "restore refuses a wrong password");
  await page.fill("#restorePw", BK); await page.click("#restoreBtn"); await visible(page, "sProtect");
  await page.check("input[name=how][value=password]"); await page.fill("#devPw", PW); await page.fill("#devPw2", PW);
  await page.click("#protectBtn"); await visible(page, "sMain");
  check((await page.textContent("#code")).trim() === code, "the restored access has the same code");
  await ctx.close();

  // ---- 3. setup with the computer's lock (virtual authenticator with PRF)
  ({ ctx, page } = await launch());
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
