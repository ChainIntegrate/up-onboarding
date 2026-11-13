# The extension as the access to ChainIntegrate's projects

**State: extension 0.5.0, 2026-11-13.** On LUKSO mainnet. Served projects: GasTrace (the gas cylinder registry),
TraceabilityRegistry, Supplier Trust Registry. What is open: [../BACKLOG.md](../BACKLOG.md).

Decisions of the maintainer: live tests on LUKSO mainnet with ChainIntegrate's own demo accounts (costs are
negligible), no Testnet deployments of the projects; no budget per project or account (today only ChainIntegrate's
accounts exist, and Supplier Trust and TraceabilityRegistry require a membership token): a simulation before each
send and a daily cap for the whole service; the relay serves only the accounts the service created.

## 1. The goal

The ChainIntegrate Account extension is the one access, for people who do not use crypto, to every ChainIntegrate
project, and the next ones. For these users it takes the place of LUKSO's Universal Profile extension and of
Cross_Chain's UP Wallet. The client never sees LYX, gas, hex data they must check, or costs.

## 2. Principles

1. **A closed set of sites.** The extension serves only pages over HTTPS on the catalog's hosts (subdomains of
   `chainintegrate.it`, one per project). On any other site it announces nothing and answers nothing.
2. **Declared operations only.** Each project declares in the catalog (section 5) what its pages may ask for, and
   how to describe each request. A request that matches nothing declared is refused, whatever site asks, without
   opening a window. A compromised subdomain can therefore ask only for declared operations, each explained in plain
   words and confirmed by the client.
3. **Every request confirmed in the extension's own window**, never in the page: what it does, for which project and
   site, on which account, in plain words, with "Confirm" and "Cancel" (focused). The window computes the description
   from the request itself, not from the page's words, and checks it again against the catalog and on the network.
4. **The gas is always ChainIntegrate's.** The client's keys hold no LYX. A project's own relayer pays where it has
   one (GasTrace); otherwise the account service does (section 6).
5. **One catalog in `shared/`**, read by the extension (to describe and allow) and by the account service (to
   relay): the two can never disagree. A project's own tests can load it (GasTrace's `scripts/admin-demo.js`).

## 3. What each project asks of the account

| Project | Site | Who signs | Request | Paid by |
|---|---|---|---|---|
| **GasTrace** (gas-cylinder-registry) | `gastrace.chainintegrate.it` | the registry's owner (the supplier's account) | EIP-712 `SetOperator` (authorize / revoke a driver's phone), `SetData` (counterparties, settings; values encrypted), `TransferOwnership` / `AcceptOwnership`; domain `GasCylinderRegistry` `1`, registries made by the factory `0xA128e7162fa8Dc779bf31EF569F06B53a499A50e` | the project's relayer (`/gcr/`) |
| | | drivers | their own app and phone key: **not the extension** (`RecordDocument` is refused) | the project's relayer |
| **TraceabilityRegistry** | `traceability.chainintegrate.it` | the client company's account | SIWE messages (sign-in, signed details for pinning metadata, library reads) | — |
| | | | factory `deployRegistry` (`0x54C3A7C31C4eCA1f1997f5E6f19197f3A82b88a3`); on registries made by it: `mintRawMaterialLot(Batch)`, `mintProductionBatch`, `invalidateEntry`, `setDocumentHash(Batch)`, `correctDocumentHash`, `setRegistryMetadata`, `addDelegate`, `removeDelegate` | the account service |
| **Supplier Trust Registry** | `supplier-trust-registry.chainintegrate.it` | the client company's account | sign-in message for the upload service | — |
| | | | on the V3 registry `0xFa143308D85b81Ed57547049F4A7718c3117A064`: `mintRegistry`, `defineSchema`, `addSupplier`, `addEvaluation`, `discloseEvaluation`, `setRegistryImage` | the account service |

ChainIntegrate's own administration (Supplier Trust `setTierLimits`, `addMembershipContract`,
`removeMembershipContract`, `setData`, `setDataForTokenId`; TraceabilityRegistry `setSector`,
`setMembershipCorporate`, `setRegistryAdmin`) is **never in a client's catalog**.

## 4. How a page finds the extension

- Two content scripts on `https://*.chainintegrate.it/*`, top frame only: `provider.js` in the page (an EIP-1193
  provider holding nothing) and `bridge.js` in the extension's isolated world. The provider is announced with
  **EIP-6963** (`name: "ChainIntegrate Account"`, `rdns: "it.chainintegrate.account"`, the icon) only after the
  extension's service worker has said, from the origin Chrome gives, that the page is a catalog's site. Nothing is
  set as `window.lukso` or `window.ethereum`: LUKSO's extension keeps working next to it.
- Methods: `eth_requestAccounts` / `eth_accounts` (the account's address, after the client connects the site once,
  in the window; "Connected sites" in the extension's page disconnects it), `eth_chainId`, `net_version`,
  `wallet_switchEthereumChain` (only to the account's network), `personal_sign`, `eth_signTypedData_v4`,
  `eth_sendTransaction`, and the reading methods (`eth_call`, `eth_blockNumber`, `eth_getLogs`, ...), forwarded to
  ChainIntegrate's node through the account service (`/api/rpc`, the node's key staying on the server) or to
  LUKSO's public node when it does not answer. Anything else is refused.
- A request that needs the client opens `confirm.html`; one request per site at a time; closing the window cancels.
  The key is opened only in that window, after the computer's lock or the password, and used for that request only.

## 5. The catalog (`shared/catalog.js`)

Per project: the sites, the name shown to the client, and what may be asked. Each answer is `{ ok, title, lines,
needs, digest }`: `title` and `lines` in Italian and English, `needs` the on-chain checks to pass first,
`digest` what the key signs.

- **Sign-in messages** (`personal_sign`): EIP-4361 as the project writes it, parsed; the domain must be the page's own
  host, URI and resources its origin, the chain the account's, the address the account's, not expired; the
  statement one the project declares (TraceabilityRegistry's operations, Supplier Trust's upload), described in
  plain words ("Confirm it is you, to upload a document").
- **Typed data** (`eth_signTypedData_v4`): the domain's name and version, no other domain field, exactly one
  declared primary type with exactly its fields, not expired; the description built from its fields ("Authorize the
  phone 0x1234…abcd to record for you"); `needs`: the verifying contract is a registry made by the project's
  factory (`isRegistry`).
- **Transactions** (`eth_sendTransaction`): the target (a fixed contract, or "a registry made by the factory X",
  checked on the network), the functions allowed, value always 0, the call exactly the encoding of its arguments;
  the description built from the decoded arguments ("Record 2 raw material lots").

The descriptions say what the operation does, never costs or payments, and no crypto term: a unit test checks every
description in both languages.

## 6. Operations with the gas paid by the account service (LSP25)

The client's key is a controller of the account (Key Manager, LSP6) without LYX. LUKSO's way to have someone else send
and pay for a controller's call is **LSP25 `executeRelayCall`**: the key signs, for the account's Key Manager, the
call, the Key Manager's nonce for that key and a validity window; anyone may submit it.

1. The page asks `eth_sendTransaction` `{ from: account, to, data }`.
2. The confirmation window matches it to the catalog, checks its `needs` on the network, shows the description, and on
   confirmation asks the service for the nonce and the network's time (`/api/relay/nonce`), signs the LSP25 message
   for `execute(CALL, to, 0, data)`, valid until ten minutes after the network's time, and sends it (`/api/relay`).
3. The service checks again, independently (`shared/relay.js`, `shared/catalog.js`): the account is one it created,
   the call is in the catalog, its `needs` hold, the daily cap; simulates (whatever the Key Manager or the target
   refuses costs nothing, and the reason is answered by name); sends `executeRelayCall` from its wallet; waits;
   answers the transaction hash.
4. The window answers the page with the hash, as a wallet would.

The same relay serves the extension's own changes to the account: the profile (stored on IPFS by the service first),
the computer's name, the account's computers (section 7).

## 7. A computer per key

Each computer has its own key on the account, revocable alone. A new computer creates its key ("Add this computer to
an existing account"), protected and backed up, and shows its code in groups of 4. An administrator authorizes it from
a computer that has the account, as:

- **administrator**: the permissions LUKSO's extension gives its main key (`0x7f3f06`);
- **access** (`UPRelay.ACCESS_PERMS` = `UPDeploy.DEVICE_PERMS`): SIGN, EXECUTE_RELAY_CALL, SUPER_CALL (the relay
  allows only the catalog's calls) and SETDATA of its own name only; no transfer of value, no profile, no keys.
  Enough for every project (GasTrace needs SIGN).

The change (`UPRelay.addDevice`, `removeDevice`: the list of keys, the permissions, the name; for access, its allowed
data key) is signed by the administrator's key and sent over the relay; the service checks it against the account's
current list of keys on the network and rebuilds it byte for byte. The new computer finds the account by itself
(`/api/lookup` reads the keys on the network), then makes the backup copy naming it. The extension's page lists the
account's computers, with "Revoke" for the others (administrators only; a key cannot revoke itself).

## 8. Open points

- **GasTrace `SetData`**: values are encrypted and signed as a hash; the window can say how many items change
  (counterparties and settings), not their content. The data key stays in the owner page, never in the extension.
- **The phone**: the same catalog in the Android app; for pages opened on a phone, WalletConnect or a direct link.
- **Accounts not created by the service** (existing Universal Profiles that authorize a ChainIntegrate key): not
  served by the relay today.
- **Review**: the security review is done when these changes are nearly complete (maintainer's decision, 2026-11-12).
