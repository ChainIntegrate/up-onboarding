# Third-party notices

The repository is released under the [MIT License](LICENSE), except as listed below. This file lists the
third-party material the repository **includes** (files committed here). Libraries that are only downloaded at
run time (ethers from cdnjs, in the web pages) or installed for the tests (`npm install`: ethers, Hardhat,
Playwright) are not included and keep their own licenses.

## Included

| What | Where | From | License |
|---|---|---|---|
| Bytecode of LUKSO's contracts (`LSP23LinkedContractsFactory`, `UniversalProfileInitPostDeploymentModule`, `UniversalProfileInit`, `LSP6KeyManagerInit`, `LSP1UniversalReceiverDelegateUP`), used only by the local test | `test/fixtures/lukso-contracts.json` | npm packages `@lukso/lsp-smart-contracts@0.14.0` and `@lukso/lsp23-contracts@0.15.0`, © LUKSO | Apache-2.0, [licenses/LUKSO-lsp-smart-contracts-Apache-2.0.txt](licenses/LUKSO-lsp-smart-contracts-Apache-2.0.txt) |
| [ethers](https://github.com/ethers-io/ethers.js) 6.13.4, `ethers.umd.min.js`, © Richard Moore | `extension/vendor/` | npm package `ethers@6.13.4`, the same file the web pages load from cdnjs | MIT, [extension/vendor/ethers-6.13.4.LICENSE.txt](extension/vendor/ethers-6.13.4.LICENSE.txt) |
| `web/lib/backup-check.js`, `web/lib/deploy-check.js`, `web/lib/theme.js`, parts of `web/lib/ui.js` and `web/lib/networks.js` | `web/lib/` | [ChainIntegrate/Cross_Chain](https://github.com/ChainIntegrate/Cross_Chain), © ChainIntegrate | MIT (same holder) |

## Loaded at run time (not included)

| What | Used by | License |
|---|---|---|
| [ethers](https://github.com/ethers-io/ethers.js) 6.13.4, from cdnjs with its integrity hash | the pages | MIT |

## Names and logos

ChainIntegrate's name and logo (`web/logo.png`, `web/icon-192.png`,
`web/favicon.ico`, `web/og-image.jpg`) are not covered by the MIT License: see "Trademarks" in
[README.md](README.md). LUKSO, Universal Profile and Universal Everything are names of their respective
owners, used only to describe what this software works with.
