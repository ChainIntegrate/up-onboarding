#!/usr/bin/env node
// E-mail alerts for the creation service, through the same mailbox as Cross_Chain's relayer monitor.
//
//   node alert.js failed <unit>   the service stopped and systemd gave up restarting it (OnFailure=)
//   node alert.js check           every 10 minutes (up-onboarding-creator-check.timer): the service answers,
//                                 the gas wallet is above its floor, no code is left in "review" or "creating";
//                                 an e-mail when a problem appears, when it lasts (every 6 hours), and when
//                                 it is solved
//   node alert.js test            a test e-mail
//
// SMTP settings from the environment (EnvironmentFile=/etc/up-onboarding/smtp.env), as in Cross_Chain:
// SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM, NOTIFICATION_EMAIL.
// The service's configuration from CREATOR_CONFIG, as for creator.js. ALERT_OUTBOX=<file>: the e-mails are
// appended to that file instead of being sent (tests).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ethers } = require("ethers");
globalThis.ethers = ethers;
const { loadConfig } = require("./creator.js");

const REMIND_HOURS = 6;

async function sendMail(subject, text) {
  const env = process.env;
  if (env.ALERT_OUTBOX) { fs.appendFileSync(env.ALERT_OUTBOX, JSON.stringify({ subject: `[up-onboarding] ${subject}`, text }) + "\n"); console.log(`e-mail (outbox): ${subject}`); return; }
  for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "NOTIFICATION_EMAIL"]) if (!env[k]) throw new Error(`missing ${k} in the environment`);
  const nodemailer = require("nodemailer");
  const t = nodemailer.createTransport({
    host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 465), secure: String(env.SMTP_SECURE || "true") === "true",
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  await t.sendMail({ from: env.SMTP_FROM, to: env.NOTIFICATION_EMAIL, subject: `[up-onboarding] ${subject}`, text });
  console.log(`e-mail sent: ${subject}`);
}

// What is wrong now: [] when everything is fine.
async function problems(cfg) {
  const out = [];
  try {
    const r = await fetch(`http://${cfg.host}:${cfg.port}/api/health`, { signal: AbortSignal.timeout(10000) });
    const b = await r.json();
    if (!r.ok || !b.ok) out.push(`The service answers ${r.status} at /api/health.`);
  } catch (e) { out.push(`The service does not answer at http://${cfg.host}:${cfg.port}/api/health (${e.message}).`); }
  try {
    const provider = new ethers.JsonRpcProvider(cfg.rpc, cfg.chainId, { staticNetwork: true });
    const w = new ethers.Wallet(fs.readFileSync(cfg.gasKeyFile, "utf8").trim());
    const balance = await provider.getBalance(w.address);
    // The floor plus about ten creations: time to top it up before the service starts refusing.
    if (balance < ethers.parseEther(cfg.minBalance) + ethers.parseEther("0.1")) out.push(`The gas wallet ${w.address} has ${ethers.formatEther(balance)} (${cfg.network}): top it up, the service refuses creations under ${cfg.minBalance}.`);
  } catch (e) { out.push(`The network (${cfg.rpc}) cannot be read: ${e.shortMessage || e.message}.`); }
  try {
    const day = new Date().toISOString().slice(0, 10);
    const n = fs.readFileSync(path.join(cfg.dataDir, "relay.jsonl"), "utf8").split("\n").filter((l) => l.includes(`"at":"${day}`)).length;
    if (n >= cfg.maxRelayPerDay) out.push(`The relay reached its daily cap (${n} of ${cfg.maxRelayPerDay}): operations are refused until tomorrow. If it is not expected, look at relay.jsonl.`);
  } catch (e) { if (e.code !== "ENOENT") out.push(`The relay log cannot be read: ${e.message}.`); }
  try {
    const invites = JSON.parse(fs.readFileSync(path.join(cfg.dataDir, "invites.json"), "utf8"));
    const stuck = Object.values(invites).filter((i) => i.state === "review" || (i.state === "creating" && Date.now() - Date.parse(i.startedAt || 0) > 15 * 60000));
    for (const i of stuck) out.push(`Code ${i.id} (${i.note || "no note"}) is "${i.state}"${i.tx ? `, transaction ${i.tx}` : ""}${i.up ? `, account ${i.up}` : ""}: check it with "node creator.js invites".`);
  } catch (e) { if (e.code !== "ENOENT") out.push(`The codes cannot be read: ${e.message}.`); }
  return out;
}

async function main() {
  const [cmd, unit] = process.argv.slice(2);
  if (cmd === "test") return sendMail("test", `A test e-mail from the creation service on ${os.hostname()}.`);
  if (cmd === "failed") {
    return sendMail(`the service is down (${unit || "up-onboarding-creator"})`,
      `The creation service stopped on ${os.hostname()} and systemd gave up restarting it: clients cannot create accounts.\n\n` +
      `Look at the log:\n  sudo journalctl -u ${unit || "up-onboarding-creator"} -n 50 --no-pager\n\nStart it again once fixed:\n  sudo systemctl restart up-onboarding-creator`);
  }
  if (cmd === "check") {
    const cfg = loadConfig();
    const stateFile = path.join(cfg.dataDir, "alert-state.json");
    let state = {};
    try { state = JSON.parse(fs.readFileSync(stateFile, "utf8")); } catch (e) { /* first run */ }
    const now = await problems(cfg);
    const key = now.join("\n");
    const due = key && (key !== state.key || Date.now() - (state.sentAt || 0) > REMIND_HOURS * 3600000);
    if (due) {
      await sendMail(key === state.key ? "still a problem" : "a problem", `On ${os.hostname()}, creation service (${cfg.network}):\n\n- ${now.join("\n- ")}\n`);
      state = { key, sentAt: Date.now() };
    } else if (!key && state.key) {
      await sendMail("solved", `On ${os.hostname()}, the creation service (${cfg.network}) is fine again. It was:\n\n- ${state.key.split("\n").join("\n- ")}\n`);
      state = {};
    } else {
      console.log(key ? "problem already reported" : "all good");
    }
    const tmp = stateFile + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 }); fs.renameSync(tmp, stateFile);
    return;
  }
  console.error("usage: alert.js check | failed <unit> | test");
  process.exit(2);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
