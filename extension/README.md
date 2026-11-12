# ChainIntegrate Account (browser extension)

The client's access to their ChainIntegrate account from a computer. Chrome, Edge and Brave (Chromium 121 or
later), Manifest V3. Separate from UP Wallet for the browser: no dApps, no networks to choose, no technical
words. **Status: 0.2: the access, the backup copy, the restore, and the creation of the account with an
invitation code. Signing for ChainIntegrate's services comes next.**

## What the client sees

1. **Welcome**: "Start: create your access" or "I already have an access: restore from the backup copy".
2. **Protect the access on this computer**: with the computer's lock (fingerprint, face or PIN through a
   passkey: Windows Hello, Touch ID, a phone) or with a password of at least 12 characters.
3. **Create the backup copy**: a file protected by a password chosen now, downloaded; the page says where to
   keep it (outside the computer, the password apart, never sent to anyone, ChainIntegrate included).
4. **Check the backup copy**: the client loads the file back and types its password. A wrong password or the
   backup of another access is refused. Only now is the access saved on the computer: a setup cannot end with
   a backup that does not open.
5. **Create your account**: the invitation code, the name, a description and a picture (optional), with the
   reminder that the profile is public. The extension unlocks the key, signs the request
   (`UPRequest.signingMessage`) and sends it to the creation service (`config.js`, `service`), on the network the
   service announces (`/api/health`); the service's refusals are told in plain words. About a minute later:
   "Your account is ready", with the name, the picture and a link to the public profile.
6. **Ready**: the account; this computer's code and name; "Check the backup copy", "Create a new backup copy"
   (unlocked with the computer's lock or password); "Remove the access from this computer", only after
   confirming the backup is at hand.

**Restore**: on a new computer, or after reinstalling, the backup file and its password give back the same
access with the same code; then the client protects it on that computer (step 2), and the extension asks the
service which account has this key (`/api/lookup`), so the account comes back too.

## How it works

- `app.html`, `app.js`: the page, opened in a tab by the toolbar button (`background.js`), not in a popup,
  which would close on the file chooser and on the passkey dialog.
- The key and its encryption are `shared/keystore.js` (a copy of `../shared/`, kept identical by
  `npm run sync`): a secp256k1 key created on the computer, stored in `chrome.storage.local` only encrypted
  (AES-256-GCM; from the passkey's PRF value through HKDF-SHA256, or from the password through PBKDF2-SHA256
  with 600,000 rounds). The backup file is the same key encrypted with the backup password.
- `passkey.js`: the passkey through WebAuthn's PRF extension; the passkey belongs to the extension's id. Where
  the authenticator gives no PRF value, the page asks for a password instead.
- The private key is in memory only while it is needed (creating the backup, sealing it on the computer) and
  wiped right after; until the backup is checked nothing is stored.
- ethers 6.13.4 is included (`vendor/`, MIT; an extension cannot load code from a server); a unit test checks
  it is byte for byte the file the web pages load from cdnjs.
- Permissions: `storage`, and `account.chainintegrate.it` (the creation service) as its only host. No content
  scripts: the extension reads nothing on the web and sends only the account request and the lookup.

## Distribution and updates

- **The extension's ID is fixed**, `djmmccacningahefoaepjgefdojohmbj`, by the public key in `manifest.json` (`key`): the same ID whatever folder the
  extension is loaded from, and on the Chrome Web Store later (its first upload carries the matching private key,
  kept by ChainIntegrate, never in this repository). Everything the extension keeps (the encrypted access, the
  passkey, which belongs to the ID) survives updates. The release workflow refuses a manifest without `key`.
- **Releases on GitHub**: a tag `extension-v<version>` runs `.github/workflows/extension-release.yml` (tests,
  pack, release). `releases/latest/download/chainintegrate-account.zip` always names the latest; the client's
  page links it, with the install steps.
- **Update notice**: the creation service announces the version of `extension/manifest.json` in its clone
  (`/api/health`); a newer one shows "A new version is available" with the download link and the steps (unzip over
  the same folder, "Reload" in chrome://extensions).
- **Stored data** keeps its format across versions (`account` in `chrome.storage.local`: the key record of
  `shared/keystore.js`, version 1, and the account fields); a version that changes it must read the old one.

## Integrity of the download and of the installed copy

The point of Cross_Chain's audit EXT-06 (2026-11-04): Chrome does not check an extension loaded from a folder, so a
program on the computer, or a sync client, could change its files; and a release should be verifiable. Here:

- **Reproducible package.** `tools/pack-extension.js` builds the same zip, byte for byte, from the same sources
  (sorted files, fixed dates and permissions, `.gitattributes`: no line-ending conversion). Anyone can rebuild a
  release from its tag: `node tools/pack-extension.js --check`.
- **SHA-256 on two channels.** `web/extension/<version>/SHA256SUMS` (the zip and every file in it) is committed,
  so reviewed with the code, and served by ChainIntegrate's own site (`account.chainintegrate.it/extension/…`);
  the GitHub release carries the same file and the zip's SHA-256 in its notes. A unit test fails when the
  package no longer matches it: a released version never changes, a change needs a new version.
- **Hardened release** (`.github/workflows/extension-release.yml`): actions pinned by commit, read-only by
  default and no stored token; the zip is built and checked against the committed SHA256SUMS before any
  dependency or test tool is installed; tests run in a separate job; the only job that may write checks the
  SHA-256 again, adds GitHub's build provenance attestation (`gh attestation verify chainintegrate-account.zip
  --repo ChainIntegrate/up-onboarding`) and publishes.
- **The extension checks itself** each time it opens: its html, js and json files against the SHA-256 that the
  site publishes for its version. When one differs it names it, says not to type any password, and refuses to
  unlock the access, to read a backup or to create one. Offline it works and checks again at the next opening.
  Limit, stated plainly: code rewritten on purpose could also rewrite this check. It catches corrupted,
  half-updated or crudely changed copies; against a targeted change the protections are the next two.
- **Checked from outside**: `node tools/verify-extension.js <folder>` compares every file of an installed copy,
  and lists extra ones, with the site's SHA256SUMS (or `--sums` a file from the release).
- **Installed outside synced folders**: the install steps say `%LOCALAPPDATA%\ChainIntegrate` on Windows and
  `~/Library/Application Support/ChainIntegrate` on a Mac, not Documents (often synced by OneDrive or iCloud).
- **The complete protection is the Chrome Web Store** (even unlisted): Chrome then verifies the files itself,
  disables a modified extension and updates it. The extension's ID is already fixed for it.

## Build, install, test

```bash
npm run pack:extension     # dist/chainintegrate-account-<version>.zip
npm run test:extension     # the flows above in Chromium, the passkey with a virtual authenticator
```

To try it by hand: `chrome://extensions`, developer mode, "Load unpacked", the `extension/` folder.
