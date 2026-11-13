#!/usr/bin/env node
// The guide's screenshots (web/guide/<lang>/*.png), made from the extension itself in Chromium with example data
// (the account "rossi-srl"), the account service answered locally: run again after a change to the extension, so the
// guide shows what the client sees.
//   node tools/guide-screenshots.js            both languages
//   node tools/guide-screenshots.js it         one
// Needs playwright (as the tests). Nothing is sent anywhere: every request to ChainIntegrate's sites is answered here.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const { ethers } = require("ethers");

const ROOT = path.join(__dirname, "..");
const EXT = path.join(ROOT, "extension");
const OUT = path.join(ROOT, "web", "guide");
const VERSION = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"))).version;
const PW = "una password lunga 1", BK = "backup password lunga 2";
const UP = ethers.getAddress("0x7a3b6c1d2e9f04ab5c8d7e6f1a2b3c4d5e6f7a8b");
const OTHER = ethers.getAddress("0x5c9e2b7a1d3f4e6b8a0c2d4e6f8a1b3c5d7e9f0a");
const URD = "0x7870C5B8BC9572A8001C3f96f7ff59961B23500D";
const REG = ethers.getAddress("0x3f8a2c6e9b1d4a7c5e8f0b2d4c6a8e1f3b5d7c9e");
const PHONE = ethers.getAddress("0x9b1d4f6a8c2e3a5b7d9f1c3e5a7b9d2f4c6e8a0b");
const SITE_HTML = "<!doctype html><title>GasTrace</title><body style='font-family:sans-serif;padding:40px'><h2>GasTrace</h2><script>window.got = []; window.addEventListener('eip6963:announceProvider', (e) => window.got.push(e.detail)); window.dispatchEvent(new Event('eip6963:requestProvider'));</script>";
const TXT = {
  it: { invite: "K7QM-2R9X-4TPH", name: "rossi-srl", cname: "Portatile ufficio", desc: "Rossi Srl, ricambi industriali", other: "Computer magazzino", newName: "Computer ufficio" },
  en: { invite: "K7QM-2R9X-4TPH", name: "rossi-srl", cname: "Office laptop", desc: "Rossi Srl, industrial spare parts", other: "Warehouse computer", newName: "Office computer" },
};

async function launch(lang) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ci-guide-"));
  const ctx = await chromium.launchPersistentContext(dir, { channel: "chromium", headless: true, acceptDownloads: true, viewport: { width: 900, height: 1000 },
    locale: lang === "en" ? "en-GB" : "it-IT", args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker");
  const id = new URL(sw.url()).host;
  const json = (body, status = 200) => (r) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await ctx.route("https://account.chainintegrate.it/extension/**", (r) => r.fulfill({ status: 404, body: "" }));
  await ctx.route("https://account.chainintegrate.it/api/health", json({ ok: true, network: "lukso", extension: { version: VERSION, download: "https://github.com/ChainIntegrate/up-onboarding/releases/latest/download/chainintegrate-account.zip" } }));
  await ctx.route("https://account.chainintegrate.it/api/lookup", json({ error: "not_found" }, 404));
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/app.html?lang=${lang}`);
  await page.evaluate((l) => localStorage.setItem("uponboarding.lang", l), lang);
  await page.reload();
  await page.waitForSelector(".screen:not([hidden])");
  return { ctx, page, id, dir };
}
const visible = (page, id) => page.waitForSelector(`#${id}:not([hidden])`, { timeout: 30000 });
const shot = async (loc, lang, name) => { fs.mkdirSync(path.join(OUT, lang), { recursive: true }); await loc.screenshot({ path: path.join(OUT, lang, name + ".png") }); console.log(`web/guide/${lang}/${name}.png`); };

async function backupAndCheck(page, dir, name, shoot) {
  await page.fill("#bkPw", BK); await page.fill("#bkPw2", BK);
  if (shoot) await shoot();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#backupBtn")]).catch(async (e) => {
    console.error("backup step:", await page.evaluate(() => [...document.querySelectorAll(".screen:not([hidden]) .msg")].map((m) => m.textContent).join(" | ")));
    throw e;
  });
  const file = path.join(dir, name); await dl.saveAs(file);
  await visible(page, "sVerify");
  await page.setInputFiles("#verifyFile", file); await page.fill("#verifyPw", BK);
  return file;
}

async function run(lang) {
  const T = TXT[lang];
  // ---- a new access, the backup copy, the account
  let { ctx, page, dir } = await launch(lang);
  await shot(page.locator("#sWelcome"), lang, "welcome");
  await page.click("#startNew"); await visible(page, "sProtect");
  await page.check("input[name=how][value=password]");
  await page.fill("#devPw", PW); await page.fill("#devPw2", PW);
  await shot(page.locator("#sProtect"), lang, "protect");
  await page.click("#protectBtn"); await visible(page, "sBackup");
  await backupAndCheck(page, dir, "b1.json", () => shot(page.locator("#sBackup"), lang, "backup"));
  await shot(page.locator("#sVerify"), lang, "verify");
  await page.click("#verifyBtn"); await visible(page, "pCreate");
  const code = (await page.textContent("#code")).trim();
  // a picture: a plain logo drawn here
  const logo = Buffer.from(await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 256; c.height = 256; const x = c.getContext("2d");
    x.fillStyle = "#1d3557"; x.fillRect(0, 0, 256, 256); x.fillStyle = "#ffffff"; x.font = "bold 150px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("R", 128, 138); return c.toDataURL("image/png").split(",")[1]; }), "base64");
  const logoFile = path.join(dir, "logo.png"); fs.writeFileSync(logoFile, logo);
  await page.fill("#invite", T.invite); await page.type("#pName", T.name); await page.fill("#cName", T.cname); await page.fill("#pDesc", T.desc);
  await page.setInputFiles("#pAvatar", logoFile); await page.waitForSelector("#avatarPrev img");
  await page.fill("#createPw", PW);
  await shot(page.locator("#pCreate"), lang, "create");
  await ctx.route("https://account.chainintegrate.it/api/create", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ up: UP, km: ethers.ZeroAddress, tx: "0x" + "ab".repeat(32), network: "lukso" }) }));
  const devices = [{ address: code, name: T.cname, role: "admin" }, { address: OTHER, name: T.other, role: "access" }];
  await ctx.route("https://account.chainintegrate.it/api/profile/read", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ account: UP, name: T.name, description: T.desc, picture: null, deviceName: T.cname, role: "admin", keys: [URD, code, OTHER], devices }) }));
  await page.click("#createBtn");
  await visible(page, "sBackup");
  await page.waitForSelector("#backupAccountNote:not([hidden])");
  await backupAndCheck(page, dir, "b2.json");
  await page.click("#verifyBtn"); await visible(page, "pAccount");
  await page.waitForFunction(() => document.querySelectorAll("#devList > div").length >= 2);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page.locator("#pAccount"), lang, "account");
  await page.click("#devAddBox summary");
  await page.fill("#devCode", "0x4e8A 1c3B 5d7F 9a2C 4e6B 8d0F 2a4C 6e8B 0d2F 4a6C"); await page.fill("#devName", T.newName);
  await shot(page.locator("#pDevices"), lang, "devices");
  await page.click("#devAddBtn"); await visible(page, "devAddConfirm");
  await shot(page.locator("#pDevices"), lang, "devices-confirm");

  // ---- a project's page: connecting and a request, in the extension's window
  await ctx.route("https://gastrace.chainintegrate.it/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: SITE_HTML }));
  const site = await ctx.newPage();
  await site.goto("https://gastrace.chainintegrate.it/");
  await site.waitForFunction(() => window.got.length > 0, null, { timeout: 10000 });
  const ask = (method, params) => site.evaluate(([m, p]) => { window.got[0].provider.request({ method: m, params: p }).catch(() => {}); }, [method, params]);
  let pop = ctx.waitForEvent("page");
  await ask("eth_requestAccounts", []);
  let w = await pop; await w.setViewportSize({ width: 460, height: 520 }); await w.waitForSelector("#ok:not([hidden])");
  await shot(w, lang, "window-connect");
  await w.click("#ok"); await w.waitForEvent("close").catch(() => {});
  const typed = { domain: { name: "GasCylinderRegistry", version: "1", chainId: 42, verifyingContract: REG },
    types: { SetOperator: [{ name: "operator", type: "address" }, { name: "enabled", type: "bool" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }] },
    primaryType: "SetOperator", message: { operator: PHONE, enabled: true, nonce: "0", deadline: String(Math.floor(Date.now() / 1000) + 3600) } };
  pop = ctx.waitForEvent("page");
  await ask("eth_signTypedData_v4", [UP, JSON.stringify(typed)]);
  w = await pop; await w.setViewportSize({ width: 460, height: 600 }); await w.waitForSelector("#ok:not([hidden])");
  await shot(w, lang, "window-request");
  await w.close();
  await ctx.close();

  // ---- a computer added to an existing account: its code
  ({ ctx, page, dir } = await launch(lang));
  await page.click("#startJoin"); await visible(page, "sProtect");
  await page.check("input[name=how][value=password]"); await page.fill("#devPw", PW); await page.fill("#devPw2", PW);
  await page.click("#protectBtn"); await visible(page, "sBackup");
  await backupAndCheck(page, dir, "b3.json");
  await page.click("#verifyBtn"); await visible(page, "pJoin");
  await shot(page.locator("#pJoin"), lang, "join");
  await ctx.close();
}

(async () => {
  const langs = process.argv[2] ? [process.argv[2]] : ["it", "en"];
  for (const l of langs) await run(l);
})().catch((e) => { console.error(e); process.exit(1); });
