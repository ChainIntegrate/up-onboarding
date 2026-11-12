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

- **The extension's ID is fixed** by the public key in `manifest.json` (`key`): the same ID whatever folder the
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

## Build, install, test

```bash
npm run pack:extension     # dist/chainintegrate-account-<version>.zip
npm run test:extension     # the flows above in Chromium, the passkey with a virtual authenticator
```

To try it by hand: `chrome://extensions`, developer mode, "Load unpacked", the `extension/` folder.
