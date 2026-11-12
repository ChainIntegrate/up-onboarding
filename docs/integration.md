# The extension as the access to ChainIntegrate's projects (design, 0.4.0 onwards)

**Status: 2026-11-12.** Decisions of the maintainer: one complete 0.4.0 (signatures and transactions together),
the relay first; live tests on LUKSO mainnet with the maintainer's accounts (costs are negligible), no Testnet
deployments of the projects; no budget per project or account (today only the maintainer's accounts exist, and
Supplier Trust and TraceabilityRegistry require a membership token): only a simulation before each send and a
daily cap for the whole service. The gas-cylinder-registry demo uses the owner script; the extension as its
owner comes after the drivers' app is published.

Done: the relay in the account service (section 6) for the account's own changes (profile, the signer's name),
tested on a local chain with LUKSO's Key Manager. Next: the extension's account changes over the relay, the
catalog, the page provider and the signing window.

## 1. The goal

The ChainIntegrate Account extension becomes the one access, for people who do not use crypto, to every
ChainIntegrate project: the gas cylinder registry (`gas-cylinder-registry`), the Supplier Trust Registry and the
TraceabilityRegistry, and the next ones. For these users it takes the place of LUKSO's Universal Profile extension and
of Cross_Chain's UP Wallet. The client never sees LYX, gas, hex data or addresses they must check.

## 2. Principles

1. **A closed set of sites.** The extension talks only to pages served over HTTPS from `chainintegrate.it`
   subdomains (every project lives on one). On any other site it does not exist: no script, no provider.
2. **Declared operations only.** Each project declares in a catalog (section 5) the operations its pages may ask
   for, and how to describe each one to the client. A request that matches no declared operation is refused,
   whatever site asks. A compromised subdomain can therefore ask only for declared operations, each explained in
   plain words and confirmed by the client.
3. **Every request confirmed in the extension's own window**, never in the page: what it does, for which project,
   on which account, in plain words, with "Confirm" and "Cancel" (focused). The window computes the description
   from the request itself, not from the page's words (as UP Wallet's signing window does).
4. **The gas is always ChainIntegrate's.** The client's key holds no LYX. A project's own relayer pays where it has
   one (gas-cylinder-registry); otherwise the account service does (section 6).
5. **One catalog in `shared/`**, read by the extension (to describe and allow) and by the account service (to
   relay): the two can never disagree.

## 3. What each project asks of the wallet today

| Project | Who signs | Request | Today paid by |
|---|---|---|---|
| **gas-cylinder-registry** | the registry's owner (the supplier) | EIP-712 `SetOperator` (authorize / revoke a driver's phone), `SetData` (counterparties, settings; values encrypted), `TransferOwnership` / `AcceptOwnership` (migration) | the project's relayer |
| | drivers | their own app and phone key: **not the extension** | the project's relayer |
| **Supplier Trust Registry** | the client company's account | sign-in message (`personal_sign`) for the upload service | — |
| | | transactions: `mintRegistry`, `defineSchema`, `addSupplier`, `addEvaluation`, `discloseEvaluation`, `setDataForTokenId`, `setRegistryImage`, `setData` | LUKSO's extension (its relayer) |
| | ChainIntegrate's admin page | `setTierLimits`, `addMembershipContract`, `removeMembershipContract` | ChainIntegrate: **not in the client's catalog** |
| **TraceabilityRegistry** | the client company's account | SIWE messages (sign-in, signed details for pinning metadata, library reads) | — |
| | | transactions: factory `deployRegistry`; registry `mintRawMaterialLotBatch`, `mintProductionBatch`, `setDocumentHash(Batch)`, `setRegistryMetadata`, `addDelegate`, `removeDelegate` | LUKSO's extension |
| | ChainIntegrate's admin page | factory `setSector`, `setMembershipCorporate`; registry `setRegistryAdmin` | ChainIntegrate: **not in the client's catalog** |

Today the pages find the wallet in `window.lukso` (LUKSO's extension) or through WalletConnect (UP Wallet).

## 4. How a page finds the extension

- A content script on `https://*.chainintegrate.it/*` injects a provider and announces it with **EIP-6963**
  (`name: "ChainIntegrate Account"`, an `rdns`, the icon). Pages add it to the wallets they offer; nothing is
  injected as `window.lukso` or `window.ethereum`, so LUKSO's extension keeps working next to it.
- Methods: `eth_requestAccounts` / `eth_accounts` (the account's address, after the client allows the site once),
  `eth_chainId` (LUKSO's), `personal_sign`, `eth_signTypedData_v4`, `eth_sendTransaction`. Anything else is refused.
- The page, the extension's content script and its service worker exchange messages; the key is opened only in the
  extension's own window, after the computer's lock or the password, as today.

## 5. The catalog (`shared/catalog.js`)

Per project: the sites (subdomains), the name shown to the client, and the operations.

- **Messages** (`personal_sign`): SIWE messages only, parsed; the domain must be the page's own host, the URI its
  origin, the chain LUKSO's, the address the account's; the statement shown. The project declares its statements
  (e.g. TraceabilityRegistry's "[Operazione / Operation: …]") and how to describe each.
- **Typed data** (`eth_signTypedData_v4`): domain name and version (e.g. `GasCylinderRegistry`, `1`), the primary
  types allowed and, for each, the description built from its fields ("Authorize the phone 0x…ab12 (Mario's
  phone)", "Revoke …"). The verifying contract must be a registry of that project (checked on-chain where the
  project has a factory).
- **Transactions** (`eth_sendTransaction`): the target (a fixed contract, e.g. a factory, or "a registry created by
  the factory X", checked on-chain), the function selectors allowed, value always 0, and the description built from
  the decoded arguments ("Record 3 raw material lots in the registry 'Malto 2026'"). Admin functions of
  ChainIntegrate are never in a client's catalog.

## 6. Transactions with the gas paid by the account service (LSP25)

The client's key is a controller of the account (Key Manager, LSP6) without LYX. LUKSO's way to have someone else
send and pay for a controller's call is **LSP25 `executeRelayCall`**: the key signs, for the account's Key Manager,
the call, the Key Manager's nonce for that key and a validity window; anyone may submit it.

1. The page asks `eth_sendTransaction` `{ from: account, to, data }`.
2. The extension matches it to the catalog, shows the description, and on confirmation asks the service for the
   nonce (`POST /api/relay/nonce`), signs the LSP25 message and sends it (`POST /api/relay`).
3. The service checks again, independently: the catalog (same file), the account is one it created (or a known
   client), the signer is a controller of it, the per-project and per-account daily limits; simulates; sends
   `executeRelayCall` from its wallet, paying the gas; waits; answers the transaction hash.
4. The extension answers the page with the hash, as a wallet would.

The same mechanism serves the extension's own changes to the account (backlog item 8): the profile, the computer's
name, a second device.

## 7. Phases

1. **0.4.0: the access and signatures.** Content script and EIP-6963 provider on `*.chainintegrate.it`; site
   permission once per site; the signing window; SIWE messages and EIP-712 typed data from the catalog. The
   gas-cylinder-registry owner operations and the sign-in of Supplier Trust and TraceabilityRegistry work.
2. **0.5.0: transactions.** The relay in the account service and the transactions of Supplier Trust and
   TraceabilityRegistry from the catalog.
3. **Account changes** (backlog item 8) on the same relay.
4. In each project (in its own repository and conversation): offer "ChainIntegrate Account" next to LUKSO's
   extension and UP Wallet; for gas-cylinder-registry, an owner page in place of the owner script, and the migration
   of the registry from the demo key to the supplier's account.

## 8. Open points

- **gas-cylinder-registry `SetData`**: values are encrypted and signed as a hash; the extension can say which kind of
  data changes (counterparties, settings), not its content. The owner page must also hold the data key (password):
  that stays in the page, never in the extension.
- **Which accounts the relay serves**: only those the service created, or also existing Universal Profiles that
  authorize a ChainIntegrate Account key?
- **Limits and costs per project** (operations per day per account, per project), and who pays: per project
  budgets of ChainIntegrate.
- **The phone**: the same catalog in the Android app; WalletConnect, or a direct link, for pages opened on a phone.
- **Review**: the security review is done when these changes are nearly complete (maintainer's decision, 2026-11-12).
