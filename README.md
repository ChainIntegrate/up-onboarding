# UP Onboarding

**Universal Profiles on LUKSO for people and companies new to crypto, with ChainIntegrate as the operator.**

A client who knows nothing about crypto gets a [LUKSO Universal Profile](https://docs.lukso.tech/standards/accounts/introduction)
of their own without buying LYX, installing LUKSO's wallet or joining Telegram, Discord or X. ChainIntegrate
sits in the middle: it prepares the profile, pays the gas and helps with every step. The profile still belongs
to the client: the keys written in it are theirs, and the operator has no power over it unless the client
chooses to make it a recovery administrator.

**Status: experimental (0.x).** No professional audit. Try everything on LUKSO Testnet first.

## Where

| | |
|---|---|
| The client's page: "Create your ChainIntegrate account" | https://account.chainintegrate.it/ |
| The operator's page (ChainIntegrate only) | https://account.chainintegrate.it/operator.html |
| How the site is published | [DEPLOY.md](DEPLOY.md), nginx files in [`tools/nginx/`](tools/nginx/) |

## The parts

| Part | What it is | Where | Status |
|---|---|---|---|
| **Browser extension** | The client's access on the computer, and where the account is created: the access protected by the computer's lock or a password, a backup copy downloaded and checked before anything else, then the invitation code, the name and the picture, and the account is ready in about a minute. Restores the access, and finds the account again, on another computer | [`extension/`](extension/) | 0.2, tested in Chromium |
| **Creation service** | Creates the account when the extension asks, with an invitation code, within daily and per-address limits, paying the gas with its own wallet: what LUKSO's relayer does for Universal Everything. Has no key or permission on any account | [`tools/creator/`](tools/creator/) | tested on a local chain |
| **Web pages** | `index.html`, for the client: the three steps, in plain words. `operator.html`, for ChainIntegrate only: creates an account by hand, from a request file or filled in | [`web/`](web/) | online at account.chainintegrate.it |
| **Shared code** | The request and its signature, the client's keys (kept encrypted, backed up), the creation call and its check: one copy used by the extension, the service and the pages | [`shared/`](shared/) | unit-tested |
| **Android app** | The same as the extension, on the phone | [`android/`](android/) | design |

This project is separate from [Cross_Chain](https://github.com/ChainIntegrate/Cross_Chain) and its UP Wallet
(the extension and the Android app), which serve people who already use crypto. The page reuses two small
read-only helpers from Cross_Chain (`web/lib/backup-check.js`, `web/lib/deploy-check.js`) and its theme script.

## How an account is created

For the client, as with Universal Everything:

1. installs the extension and chooses how to protect the access (computer's lock or password);
2. downloads the backup copy and loads it back to check it (required);
3. types the invitation code from ChainIntegrate, the name and, optionally, a description and a picture;
4. the extension signs the request with the new key and sends it to the creation service, which creates the
   account on LUKSO, paying the gas, and answers with its address in about a minute.

What the creation writes, the same whether the service or the operator's page creates it:

### Details (operator's page)

1. **The client's keys.** The client gives the operator the *addresses* of their keys, never a private key.
   Each key is an **administrator** (uses the UP and adds or removes keys: the permissions LUKSO's own
   extension gives its main key, `0x7f3f06`) or a **device** (uses the UP and its funds and updates the
   profile, but cannot manage keys: SUPER_CALL, SUPER_TRANSFERVALUE, SIGN, ERC4337 and SETDATA limited to
   `LSP3Profile`, as Cross_Chain's "Authorize a device"). At least two administrators, kept in different places,
   are recommended; the page warns when there is only one.
2. **The profile.** Name, description, tags, links, profile and cover image, as an LSP3Profile JSON stored
   either on IPFS (through the operator's Pinata account; the JWT stays in the operator's browser and goes
   only to Pinata) or inside the UP itself as a `data:` URL (no external service, small images, more gas).
3. **The request file.** Everything on the page can be saved as a JSON file (public data only) and loaded
   again: the client can fill it in alone and send it, or the operator prepares it in more sessions.
4. **Creation.** The operator connects their own wallet on LUKSO (any EIP-6963 wallet, or LUKSO's
   extension with the operator's UP). The page computes the new UP's address with the factory's
   `computeERC1167Addresses`, simulates, and sends one `deployERC1167Proxies` call to LUKSO's
   `LSP23LinkedContractsFactory` through `UniversalProfileInitPostDeploymentModule`, the same mechanism
   LUKSO's tools use. The module writes the profile, LUKSO's LSP1 delegate, the controllers, their
   permissions and names, then hands ownership to the Key Manager.
5. **Check.** After confirmation the page reads the UP back: owned by its Key Manager, the Key Manager
   targeting the UP, every controller with the permissions chosen, the profile value the one prepared.
6. **Gas for the keys.** On LUKSO each key pays its own gas: an optional step sends a few LYX to each key
   from the operator's wallet.

LUKSO contracts used (same address on LUKSO and LUKSO Testnet; the page checks each has code):

| Contract | Address |
|---|---|
| LSP23LinkedContractsFactory | `0x2300000A84D25dF63081feAa37ba6b62C4c89a30` |
| UniversalProfileInitPostDeploymentModule | `0x000000000066093407b6704B89793beFfD0D8F00` |
| UniversalProfileInit v0.14.0 | `0x3024D38EA2434BA6635003Dc1BDC0daB5882ED4F` |
| LSP6KeyManagerInit v0.14.0 | `0x2Fe3AeD98684E7351aD2D408A43cE09a738BF8a4` |
| LSP1UniversalReceiverDelegateUP | `0x7870C5B8BC9572A8001C3f96f7ff59961B23500D` |

## Pages

Every page is in Italian and English, with a toggle at the top (the choice is kept in the browser; `?lang=en`
or `?lang=it` sets it from a link). The look is ChainIntegrate's logo: light grey, ink, teal and slate blue, with
a dark theme on request (the button next to the language). Pages load only their own scripts and ethers 6.13.4 from cdnjs with its
integrity hash, and never hold a private key.

| Page | For | What it does |
|---|---|---|
| `web/index.html` | the client | "Create your ChainIntegrate account": the public profile, the access devices (the codes shown by ChainIntegrate's app or extension, each *main* or *access only*), then the request file to download and send. Link parameters: `?code=0x…&name=…` fill in the first device |
| `web/operator.html` | ChainIntegrate | Loads a client's request (or is filled in by hand), creates the Universal Profile and checks it; not indexed by search engines |

**Wording of the client's page.** The client is creating an account to use ChainIntegrate's services, and
nothing on the page should recall crypto: it speaks of an account, a public profile, access devices and their
codes. No blockchain, crypto, wallet, token, gas, LYX, LUKSO, Universal Profile, Ethereum or Bitcoin, in either
language: `test/e2e.js` fails if one appears (title, text, placeholders, descriptions). The one technical trace
left is the device code's `0x` prefix, which the client copies from the app. The operator's page keeps the
technical terms: only ChainIntegrate uses it.

**No recovery by ChainIntegrate, by design.** The account belongs to the client's keys only: ChainIntegrate
never adds a key of its own, so it has no power over any account, holds nothing that could be stolen from all
clients at once, and is not a custodian. What protects the client is the backup copy, which the extension makes
them download and check before anything else; the pages say plainly that no one can recover an account in
their place.

## Tests

```bash
npm install
npx playwright install chromium
npm test
npm run pack:extension   # the extension's zip, in dist/
```

- `npm run test:unit` (`test/unit/`): the request file's checks, the key store (password and device secret,
  wrong secrets, a record with a changed address, tampered ciphertext, the backup file) and that
  `web/lib/shared/` is a copy of `shared/` (`npm run sync` updates it).
- `npm run test:extension` (`test/extension.js`) loads the extension in Chromium: setup with a password and
  with the computer's lock (a virtual authenticator with PRF), the backup required and checked (a wrong password
  and another access's backup refused, nothing stored before the check), a new backup copy, removal, restore
  on a new profile with the same code, and no crypto term on any screen.
- `npm run test:e2e` (`test/e2e.js`) starts a local Hardhat chain with LUKSO Testnet's chainId and LUKSO's own
  contracts at their official addresses (`test/fixtures/lukso-contracts.json`, bytecode from LUKSO's npm
  packages `@lukso/lsp-smart-contracts@0.14.0` and `@lukso/lsp23-contracts@0.15.0`), runs the page in Chromium
  with a test wallet, creates a UP and checks it: the page's own verification, a device key that can update the
  profile but cannot add a controller, an administrator that can, the LYX step, the request file saved and
  loaded back, the client's page (no crypto term in Italian or English, its request loaded by the operator's page), IPFS mode (Pinata answered locally), the language toggle and the layout at phone width.

Both run on GitHub Actions at every push (`.github/workflows/test.yml`).

## License

The code is released under the MIT License, see [LICENSE](LICENSE). Third-party material included in the
repository and its licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Trademarks

"ChainIntegrate" and its logo are ChainIntegrate's and are **not** licensed under the MIT License.
You may use the code, but a copy or a modified version must not present itself as ChainIntegrate or as
ChainIntegrate's service, and must not use its name or logo except to say, truthfully, that it is based on this
project.

Not an official LUKSO product. LUKSO, Universal Profile and Universal Everything are names of their respective
owners, used only to describe what this software works with.
