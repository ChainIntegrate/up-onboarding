# UP Onboarding

**Universal Profiles on LUKSO for people and companies new to crypto, with ChainIntegrate as the operator.**

A client who knows nothing about crypto gets a [LUKSO Universal Profile](https://docs.lukso.tech/standards/accounts/introduction)
of their own without buying LYX, installing LUKSO's wallet or joining Telegram, Discord or X. ChainIntegrate
sits in the middle: it prepares the profile, pays the gas and helps with every step. The profile still belongs
to the client: the keys written in it are theirs, and the operator has no power over it unless the client
chooses to make it a recovery administrator.

**Status: experimental (0.x).** No professional audit. Try everything on LUKSO Testnet first.

## The parts

| Part | What it is | Where | Status |
|---|---|---|---|
| **Web page** | Creates the Universal Profile: profile, keys and permissions, one transaction to LUKSO's LSP23 factory sent and paid by the operator | [`web/`](web/) | working, tested on a local chain |
| **Browser extension** | The client's keys on the computer: creates them, prepares the request for the operator, signs for ChainIntegrate's services. Separate from UP Wallet | [`extension/`](extension/) | design |
| **Android app** | The same on the phone. Separate from UP Wallet for Android | [`android/`](android/) | design |
| **Shared code** | Key storage, signing and the request format, used by both the extension and the app | [`shared/`](shared/) | design |

This project is separate from [Cross_Chain](https://github.com/ChainIntegrate/Cross_Chain) and its UP Wallet
(the extension and the Android app), which serve people who already use crypto. The page reuses two small
read-only helpers from Cross_Chain (`web/lib/backup-check.js`, `web/lib/deploy-check.js`) and its theme script.

## How a profile is created

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
or `?lang=it` sets it from a link). Pages load only their own scripts and ethers 6.13.4 from cdnjs with its
integrity hash, and never hold a private key.

| Page | What it does |
|---|---|
| `web/up-create.html` | Creates a Universal Profile for a client. Link parameters: `?network=lukso-testnet&key=0x…&name=…&role=device` fill in the first key |

## Tests

```bash
npm install
npm test
```

`test/e2e.js` starts a local Hardhat chain with LUKSO Testnet's chainId and LUKSO's own contracts at their
official addresses (`test/fixtures/lukso-contracts.json`, bytecode from LUKSO's npm packages
`@lukso/lsp-smart-contracts@0.14.0` and `@lukso/lsp23-contracts@0.15.0`), runs the page in Chromium with a
test wallet, creates a UP and checks it: the page's own verification, a device key that can update the
profile but cannot add a controller, an administrator that can, the LYX step, the request file, IPFS mode
(Pinata answered locally), the language toggle and the layout at phone width.

## License

The code is released under the MIT License, see [LICENSE](LICENSE). Third-party material included in the
repository and its licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Trademarks

"ChainIntegrate", its logo and its banner are ChainIntegrate's and are **not** licensed under the MIT License.
You may use the code, but a copy or a modified version must not present itself as ChainIntegrate or as
ChainIntegrate's service, and must not use its name or logo except to say, truthfully, that it is based on this
project.

Not an official LUKSO product. LUKSO, Universal Profile and Universal Everything are names of their respective
owners, used only to describe what this software works with.
