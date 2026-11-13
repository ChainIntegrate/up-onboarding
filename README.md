# UP Onboarding

**ChainIntegrate Account: a LUKSO Universal Profile for people and companies new to crypto, with ChainIntegrate as
the operator, and the one access to ChainIntegrate's projects.**

A client who knows nothing about crypto gets an account of their own (a [LUKSO Universal Profile](https://docs.lukso.tech/standards/accounts/introduction))
without buying LYX, installing LUKSO's wallet or joining Telegram, Discord or X. ChainIntegrate sits in the middle,
as LUKSO's relayer does for Universal Everything: it creates the account with an invitation code and pays for every
operation. The account belongs to the client: the keys written in it are theirs, created on their computers, and
ChainIntegrate holds no key and no permission on it.

The same browser extension is then the client's access to ChainIntegrate's projects (GasTrace, TraceabilityRegistry,
Supplier Trust Registry): each request of a project's page is confirmed in the extension's own window, in plain
words, and ChainIntegrate's service sends the operations and pays for them.

**Status: 0.5 on LUKSO mainnet**, used with ChainIntegrate's own demo accounts. No professional audit yet (planned
when the changes are nearly complete). What is done and what is next: [BACKLOG.md](BACKLOG.md).

## Where

| | |
|---|---|
| The client's page: "Create your ChainIntegrate account" (install the extension) | https://account.chainintegrate.it/ |
| The privacy notice (extension and account service) | https://account.chainintegrate.it/privacy.html |
| The operator's page (ChainIntegrate only) | https://account.chainintegrate.it/operator.html |
| The extension's releases | [GitHub releases](https://github.com/ChainIntegrate/up-onboarding/releases), `extension-v<version>` |
| How the site and the service are published | [DEPLOY.md](DEPLOY.md), nginx files in [`tools/nginx/`](tools/nginx/) |

## The parts

| Part | What it is | Where |
|---|---|---|
| **Browser extension** "ChainIntegrate Account" | The client's access on a computer: its own key, protected by the computer's lock or a password, with a required backup copy; the account's creation with an invitation code; changes to the profile; the account's computers (add, authorize, revoke); the access to the projects' pages, each request confirmed in its own window | [`extension/`](extension/) |
| **Account service** | Creates the accounts (invitation codes, daily and per-address limits) and sends the operations a key of the account signs (LSP25 relay), paying the gas with its own wallet; reads the network for the extension from ChainIntegrate's node; e-mail alerts, nightly backup | [`tools/creator/`](tools/creator/) |
| **The projects' catalog** | What each project's pages may ask of an account and how to say it in plain words: read by the extension (to describe and allow) and by the service (to relay), one file | [`shared/catalog.js`](shared/catalog.js), [`docs/integration.md`](docs/integration.md) |
| **Web pages** | `index.html`, for the client: the three steps and the extension's download. `operator.html`, for ChainIntegrate only: creates an account by hand. `privacy.html` | [`web/`](web/) |
| **Shared code** | The request and its signature, the key store, the creation call, the relay, the catalog, IPFS: one copy used by the extension, the service and the pages (`npm run sync` copies it) | [`shared/`](shared/) |
| **Android app** | The same as the extension, on the phone | [`android/`](android/) (design) |

This project is separate from [Cross_Chain](https://github.com/ChainIntegrate/Cross_Chain) and its UP Wallet
(the extension and the Android app), which serve people who already use crypto.

## How it works for the client

1. installs the extension (the client's page links the latest release) and protects the access on the computer
   (the computer's lock or a password);
2. downloads the backup copy and loads it back to check it (required before anything else);
3. types the invitation code from ChainIntegrate, the profile's name and, optionally, a description and a picture:
   the extension signs the request with the computer's key and the service creates the account, paying, in about a
   minute; then a backup copy naming the account is required;
4. uses the account on the projects' sites (`*.chainintegrate.it`): the site finds the extension, and every sign-in,
   signature or operation is confirmed in the extension's window;
5. adds another computer with its own key ("Add this computer to an existing account", authorized from a computer
   that has the account), revokes a lost one, restores from the backup copy.

What a creation writes, the same whether the service or the operator's page creates it: one `deployERC1167Proxies`
call to LUKSO's `LSP23LinkedContractsFactory` through `UniversalProfileInitPostDeploymentModule` (the mechanism
LUKSO's own tools use), which writes the profile (an LSP3Profile JSON on ChainIntegrate's IPFS node), LUKSO's LSP1
delegate, the client's keys with their permissions and names, then hands the account to its Key Manager. The
account is read back and checked afterwards.

**Keys and roles.** Each key is an **administrator** (the permissions LUKSO's own extension gives its main key,
`0x7f3f06`: everything, including the keys) or **access** (signs, uses the projects' operations through the relay
and changes its own name; no transfer of value, no profile, no keys: SUPER_CALL, SIGN, EXECUTE_RELAY_CALL and
SETDATA limited to its own name). The creation's "device" role (operator's page, Android) is the same as access.

LUKSO contracts used (same address on LUKSO and LUKSO Testnet; the page and the service check each has code):

| Contract | Address |
|---|---|
| LSP23LinkedContractsFactory | `0x2300000A84D25dF63081feAa37ba6b62C4c89a30` |
| UniversalProfileInitPostDeploymentModule | `0x000000000066093407b6704B89793beFfD0D8F00` |
| UniversalProfileInit v0.14.0 | `0x3024D38EA2434BA6635003Dc1BDC0daB5882ED4F` |
| LSP6KeyManagerInit v0.14.0 | `0x2Fe3AeD98684E7351aD2D408A43cE09a738BF8a4` |
| LSP1UniversalReceiverDelegateUP | `0x7870C5B8BC9572A8001C3f96f7ff59961B23500D` |

**No recovery by ChainIntegrate, by design.** ChainIntegrate never adds a key of its own, so it has no power over
any account, holds nothing that could be stolen from all clients at once, and is not a custodian. What protects
the client is the backup copy (required, and checked when it is made) and a second computer with its own key.

**Wording.** The client is creating an account to use ChainIntegrate's services, and nothing they see should recall
crypto: an account, a public profile, computers and their codes. No blockchain, crypto, wallet, token, gas, LYX,
LUKSO, Universal Profile, Ethereum or Bitcoin, in either language, nor costs or payments in the confirmation
window: the tests fail if one appears (the client's page, the extension's page, the confirmation windows, every
description of the catalog). The operator's page keeps the technical terms: only ChainIntegrate uses it.

## Pages

Every page is in Italian and English, with a toggle at the top (kept in the browser; `?lang=en` or `?lang=it` sets
it from a link), ChainIntegrate's look (light grey, ink, teal and slate blue) and a dark theme on request. Pages
load only their own scripts and ethers 6.13.4 from cdnjs with its integrity hash, and never hold a private key.

| Page | For | What it does |
|---|---|---|
| `web/index.html` | the client | "Create your ChainIntegrate account": the three steps in plain words, the extension's download (`releases/latest`) and how to install it in a folder that is not synced, the questions people ask |
| `web/privacy.html` | everyone | The privacy notice of the extension and the account service |
| `web/operator.html` | ChainIntegrate | Creates an account by hand (a request file or filled in), with the operator's own wallet, and checks it; not indexed |

## Tests

```bash
npm install
npx playwright install chromium
npm test
npm run pack:extension   # the extension's zip, in dist/ (reproducible)
```

- `npm run test:unit` (`test/unit/`): the request, the key store, the relay (profile, names, devices), the catalog
  (every project's requests, refusals, and no crypto term, cost or payment in any description), the extension's
  package against its published SHA256SUMS, the vendored ethers, the shared copies.
- `npm run test:e2e` (`test/e2e.js`): a local Hardhat chain with LUKSO's own contracts at their official addresses
  (`test/fixtures/lukso-contracts.json`, bytecode from `@lukso/lsp-smart-contracts@0.14.0` and
  `@lukso/lsp23-contracts@0.15.0`), the operator's page creating and checking an account, the keys' permissions,
  the client's page (no crypto term), the language toggle and the layout at phone width.
- `npm run test:creator` (`test/creator.js`): the account service on that chain with LUKSO's chain id: creation and
  its limits, the relay (profile, names, the projects' catalog with its on-chain checks, devices authorized and
  revoked, everything the Key Manager refuses), `/api/rpc`, the alerts, backup and rebuild, withdraw.
- `npm run test:extension` (`test/extension.js`): the extension in Chromium: setup with a password and with the
  computer's lock (a virtual authenticator with PRF), backup and restore, creation, changes, the account's
  computers, joining an account, integrity, the projects' pages (EIP-6963, connect, sign-in, operations, GasTrace's
  typed data, refusals), and no crypto term on any screen or confirmation window.

All run on GitHub Actions at every push (`.github/workflows/test.yml`); a release runs them again
(`.github/workflows/extension-release.yml`).

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
