// The toolbar button opens the extension's page in a tab (a tab, not a popup: a popup closes when a file is
// chosen or a passkey dialog opens). One tab only: an open one is brought to the front. Also opened right after
// installation, to start the setup.
"use strict";
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
