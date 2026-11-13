# ChainIntegrate Account (browser extension)

The client's access to their ChainIntegrate account from a computer, and to ChainIntegrate's projects. Chrome, Edge
and Brave (Chromium 121 or later), Manifest V3. Separate from UP Wallet for the browser: no networks to choose, no
technical words, only ChainIntegrate's sites. **Status: 0.5.0** (what changed in each version: [../BACKLOG.md](../BACKLOG.md)).

## What the client sees

1. **Welcome**: "Start: create your access", "I already have an access: restore from the backup copy", or "Add
   this computer to an existing account".
2. **Protect the access on this computer**: with the computer's lock (fingerprint, face or PIN through a passkey:
   Windows Hello, Touch ID, a phone) or with a password of at least 12 characters.
3. **Create the backup copy**, then **check it**: a file protected by a password chosen now, downloaded and loaded
   back with its password. A wrong password or another access's copy is refused, and nothing is saved on the
   computer before the check passes.
4. **Create your account**: the invitation code, the profile's name (lowercase letters, digits and hyphens), this
   computer's name, a description and a picture (optional), with the reminder that the profile is public. The
   extension signs the request with the computer's key and sends it to the account service; about a minute later
   the account is ready. A **new backup copy naming the account** is then required, made and checked as before.
   *Or*, for a computer added to an existing account: its code, in groups of 4, to type on a computer that has the
   account; as soon as it is authorized the account appears by itself, then the backup copy naming it is required.
5. **Ready**:
   - the account: its address (copy), its name and picture, the link to the public profile;
   - "Change the profile or this computer's name" (the profile: administrators only);
   - "Your account's computers": their names and roles; for administrators, "Authorize another computer" (its
     code, a name, administrator or access) and "Revoke" for the others, each confirmed;
   - "Connected sites": the projects' sites that see the account's address, each can be disconnected;
   - this computer's code and name; "Check the backup copy", "Create a new backup copy"; "Remove the access from
     this computer", after a confirmation that names the account.
6. **On a project's site** (`*.chainintegrate.it`, only the sites of the catalog): the site finds "ChainIntegrate
   Account" among the wallets it offers. Connecting, a sign-in, a signature or an operation opens the extension's
   **confirmation window**: what it does for which project and site, in plain words computed from the request
   itself; "Cancel" has the focus; "Confirm" unlocks the key for that one request. A request outside the catalog
   is refused without a window.

**Restore**: on a new computer, or after reinstalling, the backup file and its password give back the same access
with the same code; the account comes from the file (confirmed by the service), and the profile and this
computer's name are read back from the account.

## How it works

- `app.html`, `app.js`: the extension's page, opened in a tab by the toolbar button (`background.js`), not in a
  popup, which would close on the file chooser and on the passkey dialog.
- The key: `shared/keystore.js` (a copy of `../shared/`, kept identical by `npm run sync`): a secp256k1 key created
  on the computer, stored in `chrome.storage.local` only encrypted (AES-256-GCM; from the passkey's PRF value
  through HKDF-SHA256, or from the password through PBKDF2-SHA256 with 600,000 rounds). The backup file is the
  same key encrypted with the backup password, with the account's address in clear once it exists.
- `passkey.js`: the passkey through WebAuthn's PRF extension, belonging to the extension's ID; where the
  authenticator gives no PRF value the page asks for a password instead.
- The private key is in memory only while it is needed (one signature, one backup) and wiped right after.
- Changes to the account (profile, names, computers): signed by the computer's key for the account's Key Manager
  (LSP25) and sent by the account service, which pays (`shared/relay.js`; [../docs/integration.md](../docs/integration.md)).
- The projects' pages: `provider.js` (in the page, EIP-6963, holds nothing; nothing is set as `window.ethereum` or
  `window.lukso`), `bridge.js` (isolated world, forwards), `background.js` (serves only the sites of the catalog,
  `shared/catalog.js`, by the origin Chrome gives; reading the network goes to ChainIntegrate's node through the
  account service, `/api/rpc`, the node's key staying on the server, and to LUKSO's public node when it does not
  answer), `confirm.html` and `confirm.js` (the request checked again against the catalog, its on-chain checks,
  the description, the key unlocked, the signature or the operation through the relay, the answer to the page's
  tab; closing the window cancels).
- `lib/integrity.js`: the extension's files against the SHA-256 published for its version; the key is not unlocked
  when one differs (in the page and in the confirmation window).
- ethers 6.13.4 is included (`vendor/`, MIT; an extension cannot load code from a server); a unit test checks it is
  byte for byte the file the web pages load from cdnjs.
- Permissions: `storage`; hosts `account.chainintegrate.it` (the account service) and LUKSO's public nodes (the
  fallback for reading the network); content scripts on `https://*.chainintegrate.it/*`, which announce the
  extension only on the catalog's sites.

## Distribution and updates

- **The extension's ID is fixed**, `djmmccacningahefoaepjgefdojohmbj`, by the public key in `manifest.json` (`key`): the same ID whatever folder the
  extension is loaded from, and on the Chrome Web Store later (its first upload carries the matching private key,
  kept by ChainIntegrate, never in this repository). Everything the extension keeps (the encrypted access, the
  passkey, which belongs to the ID) survives updates. The release workflow refuses a manifest without `key`.
- **Releases on GitHub**: `.github/workflows/extension-release.yml`, run by hand on `main` (it creates the tag
  `extension-v<version>`) or by a pushed tag: tests, pack, release. `releases/latest/download/chainintegrate-account.zip` always names the latest; the client's
  page links it, with the install steps.
- **Update notice**: the account service announces the latest *released* version (`/api/health`, from
  `web/extension/latest.txt`, updated right after each release, so a version in development on main is never
  offered); a newer one shows "A new version is available" with the direct download of the zip and the steps:
  unzip over the same folder, then "Reload" in chrome://extensions (Chrome remembers the folder: "Load unpacked"
  is needed only the first time).
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
npm run test:extension     # the flows above in Chromium, the passkey with a virtual authenticator, the projects' pages routed locally
```

To try it by hand: `chrome://extensions`, developer mode, "Load unpacked", the `extension/` folder.
