// The extension's service worker.
//
// 1. The toolbar button opens the extension's page in a tab (a tab, not a popup: a popup closes when a file is
//    chosen or a passkey dialog opens). One tab only: an open one is brought to the front. Also opened right after
//    installation, to start the setup.
// 2. The requests of ChainIntegrate's projects' pages (provider.js → bridge.js → here). Only pages of a project in
//    the catalog (shared/catalog.js), by the origin Chrome gives, not the page's word. Reading the network goes to
//    LUKSO's public node; asking for the account's address, a signature or an operation opens the confirmation window
//    (confirm.html), which checks the request again, shows it in plain words and answers the page itself. Whatever
//    is not in the catalog is refused here, without a window.
"use strict";
importScripts("vendor/ethers-6.13.4.umd.min.js", "config.js", "shared/catalog.js");
const PAGE = chrome.runtime.getURL("app.html");

async function openPage() {
  // runtime.getContexts lists this extension's own open pages, with no "tabs" permission.
  const [ctx] = await chrome.runtime.getContexts({ contextTypes: ["TAB"], documentUrls: [PAGE] });
  if (ctx && ctx.tabId >= 0) {
    await chrome.tabs.update(ctx.tabId, { active: true });
    await chrome.windows.update(ctx.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: PAGE });
  }
}
chrome.action.onClicked.addListener(openPage);
chrome.runtime.onInstalled.addListener((d) => { if (d.reason === "install") openPage(); });

// ---- the projects' pages
const ERR = {
  rejected: { code: 4001, message: "The request was cancelled." },
  unauthorized: { code: 4100, message: "Connect ChainIntegrate Account to this site first (eth_requestAccounts)." },
  noAccount: { code: 4100, message: "ChainIntegrate Account has no account on this computer yet." },
  unsupported: { code: 4200, message: "ChainIntegrate Account does not support this method." },
  busy: { code: -32002, message: "A request of this site is already waiting for confirmation." },
  chain: { code: 4902, message: "ChainIntegrate Account works only on its account's network." },
};
const refused = (reason) => ({ code: 4100, message: `Not allowed by ChainIntegrate Account (${reason}).` });
// Reading the network: forwarded to LUKSO's node as they are.
const READ = new Set(["eth_blockNumber", "eth_call", "eth_estimateGas", "eth_gasPrice", "eth_feeHistory", "eth_maxPriorityFeePerGas",
  "eth_getBalance", "eth_getCode", "eth_getStorageAt", "eth_getTransactionCount", "eth_getTransactionByHash", "eth_getTransactionReceipt",
  "eth_getBlockByNumber", "eth_getBlockByHash", "eth_getLogs"]);

let iconUrl = null;
const UUID = crypto.randomUUID(); // EIP-6963: one per session of the wallet
async function info() {
  if (!iconUrl) {
    const bytes = new Uint8Array(await (await fetch(chrome.runtime.getURL("img/icon-48.png"))).arrayBuffer());
    iconUrl = "data:image/png;base64," + ethers.encodeBase64(bytes);
  }
  return { uuid: UUID, name: "ChainIntegrate Account", rdns: "it.chainintegrate.account", icon: iconUrl };
}

const local = async (k) => (await chrome.storage.local.get(k))[k];
const session = chrome.storage.session;

async function rpc(network, method, params) {
  const res = await fetch(CONFIG.networks[network].rpc, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const b = await res.json();
  if (b.error) return { error: { code: Number.isInteger(b.error.code) ? b.error.code : -32603, message: String(b.error.message || "error"), data: b.error.data } };
  return { result: b.result };
}

// What the window will do, checked here first so a request outside the catalog opens no window.
function precheck(project, account, chainId, origin, method, params) {
  const same = (a) => typeof a === "string" && ethers.isAddress(a) && ethers.getAddress(a) === account;
  if (method === "personal_sign") {
    const [data, address] = params;
    if (!same(address)) return { error: refused("other_account") };
    let text;
    try { text = ethers.isHexString(data) ? ethers.toUtf8String(data) : String(data); } catch (e) { return { error: refused("not_text") }; }
    const r = UPCatalog.message(project, text, { origin, account, chainId });
    return r.ok ? { ok: true } : { error: refused(r.error) };
  }
  if (method === "eth_signTypedData_v4") {
    const [address, typed] = params;
    if (!same(address)) return { error: refused("other_account") };
    const r = UPCatalog.typedData(project, typed, { account, chainId });
    return r.ok ? { ok: true } : { error: refused(r.error) };
  }
  if (method === "eth_sendTransaction") {
    const tx = params[0] || {};
    if (!same(tx.from)) return { error: refused("other_account") };
    if (tx.data === undefined && tx.input !== undefined) tx.data = tx.input;
    let value;
    try { value = BigInt(tx.value || 0); } catch (e) { return { error: refused("value") }; }
    const r = UPCatalog.call({ chainId, to: tx.to, data: tx.data, value }, project);
    return r.ok ? { ok: true } : { error: refused(r.error) };
  }
  return { error: ERR.unsupported };
}

async function openWindow(req) {
  const busyFor = Object.values(await session.get(null)).some((r) => r && r.rid && r.origin === req.origin);
  if (busyFor) return { error: ERR.busy };
  const rid = crypto.randomUUID();
  await session.set({ ["req:" + rid]: { ...req, rid, at: Date.now() } });
  const w = await chrome.windows.create({ url: chrome.runtime.getURL("confirm.html?r=" + rid), type: "popup", width: 460, height: 680, focused: true });
  await session.set({ ["win:" + w.id]: rid });
  return { pending: true };
}

async function handle(sender, msg) {
  const origin = sender.origin;
  const project = UPCatalog.projectForOrigin(origin);
  if (!project) return { error: refused("site") };
  const method = msg.method, params = Array.isArray(msg.params) ? msg.params : [];
  const acc = await local("account");
  const network = acc && acc.up ? (acc.network || "lukso") : "lukso";
  const chainId = CONFIG.networks[network].chainId;
  if (method === "eth_chainId") return { result: "0x" + chainId.toString(16) };
  if (method === "net_version") return { result: String(chainId) };
  if (READ.has(method)) return rpc(network, method, params);
  if (method === "wallet_switchEthereumChain") {
    return params[0] && Number(params[0].chainId) === chainId ? { result: null } : { error: ERR.chain };
  }
  const account = acc && acc.up && acc.record ? ethers.getAddress(acc.up) : null;
  const sites = (await local("sites")) || {};
  const connected = !!account && sites[origin] && sites[origin].account === account;
  if (method === "eth_accounts") return { result: connected ? [account] : [] };
  if (!account) return { error: ERR.noAccount };
  const req = { origin, tabId: sender.tab.id, frameId: sender.frameId, id: msg.id, method, params, project: project.id, account, network, chainId };
  if (method === "eth_requestAccounts") return connected ? { result: [account] } : openWindow(req);
  if (!connected) return { error: ERR.unauthorized };
  const pre = precheck(project, account, chainId, origin, method, params);
  if (pre.error) return pre;
  return openWindow(req);
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !msg || !sender.tab || sender.frameId !== 0 || !sender.origin) return;
  if (msg.kind === "hello") {
    if (!UPCatalog.projectForOrigin(sender.origin)) { reply({ ok: false }); return; }
    info().then((i) => reply({ ok: true, info: i }), () => reply({ ok: false }));
    return true;
  }
  if (msg.kind === "request" && Number.isInteger(msg.id) && typeof msg.method === "string") {
    handle(sender, msg).then(reply, (e) => reply({ error: { code: -32603, message: String(e && e.message || e) } }));
    return true;
  }
});

// The window closed without an answer: the page hears "cancelled".
chrome.windows.onRemoved.addListener(async (windowId) => {
  const key = "win:" + windowId;
  const rid = (await session.get(key))[key];
  if (!rid) return;
  await session.remove(key);
  const rk = "req:" + rid;
  const req = (await session.get(rk))[rk];
  if (!req) return;
  await session.remove(rk);
  chrome.tabs.sendMessage(req.tabId, { kind: "response", id: req.id, error: ERR.rejected }, { frameId: req.frameId }).catch(() => {});
});
