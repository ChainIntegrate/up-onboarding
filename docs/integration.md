# The extension as the access to ChainIntegrate's projects

**State: extension 0.6.1, 2026-11-20.** On LUKSO mainnet. Served projects: GasTrace (the gas cylinder registry),
TraceabilityRegistry, Supplier Trust Registry. What is open: [../BACKLOG.md](../BACKLOG.md).

Decisions of the maintainer: live tests on LUKSO mainnet with ChainIntegrate's own demo accounts (costs are
negligible), no Testnet deployments of the projects; no budget per project or account (today only ChainIntegrate's
accounts exist, and Supplier Trust and TraceabilityRegistry require a membership token): a simulation before each
send, a daily cap per account and for the whole service, a gas cap per operation; the relay serves only the
accounts the service created.

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
| **GasTrace** (gas-cylinder-registry) | `gastrace.chainintegrate.it` | the registry's owner (the supplier's account), from an administrator's computer only (section 7) | EIP-712, version 2 of the registries: `SetOperator` (authorize / revoke a driver's phone), `SetData` (counterparties, settings, a new data key; values encrypted), `TransferOwnership` (completed after 3 days) / `CancelOwnershipTransfer` / `AcceptOwnership` (to this account), `RecordDocument` (the owner's own corrections), `CancelNonces` (the owner's own requests); each with `validFrom` and `deadline`; domain `GasCylinderRegistry` `2`, registries made by the factory V2 `0xd60146C03f288fCeEEdB90731f162fF57F7ebdd2` | the project's relayer (`/gcr/`) |
| | | drivers | their own app and phone key: **not the extension** (a `RecordDocument` signed for another key is refused) | the project's relayer |
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
  set on `window` (no `window.lukso`, no `window.ethereum`): LUKSO's extension keeps working next to it.
- Methods: `eth_requestAccounts` / `eth_accounts` (the account's address, after the client connects the site once,
  in the window; "Connected sites" in the extension's page disconnects it), `eth_chainId`, `net_version`,
  `wallet_switchEthereumChain` (only to the account's network), `personal_sign`, `eth_signTypedData_v4`,
  `eth_sendTransaction`, and the reading methods (`eth_call`, `eth_blockNumber`, `eth_getLogs`, ...), forwarded to
  ChainIntegrate's node through the account service (`/api/rpc`, the node's key staying on the server; answered
  only with the extension's origin) or to LUKSO's public node when it does not answer; a node is used only after it
  answered the account's chain id itself (`eth_chainId`, asked again every 10 minutes). Anything else is refused.
- A request that needs the client opens `confirm.html`; one request per site at a time (a request left behind, its
  window gone or older than 15 minutes, no longer blocks the site); closing the window cancels.
  The key is opened only in that window, after the computer's lock or the password, and used for that request only.

## 5. The catalog (`shared/catalog.js`)

Per project: the sites, the name shown to the client, and what may be asked. Each answer is `{ ok, title, lines,
needs, digest }`: `title` and `lines` in Italian and English, `needs` the on-chain checks to pass first,
`digest` what the key signs.

- **Sign-in messages** (`personal_sign`): EIP-4361 as the project writes it, parsed; the domain must be the page's own
  host, URI and resources its origin, the chain the account's, the address the account's, not expired, issued within 15 minutes, no `Not Before` still
  to come, an expiry at most 7 days away; the
  statement one the project declares (TraceabilityRegistry's operations, Supplier Trust's upload), described in
  plain words ("Confirm it is you, to upload a document").
- **Typed data** (`eth_signTypedData_v4`): the domain's name and version, no other domain field, exactly one
  declared primary type with exactly its fields, not expired; the description built from its fields ("Authorize the
  phone 0x1234…abcd to record for you"); `needs`: the verifying contract is a registry made by the project's
  factory (`isRegistry`).
- **GasTrace's `SetData`**: only the registry's known data keys (the data key's two wraps, the settings, customers
  and refill centres, the public description); the request's `dataValues` checked against the signed hash; the
  registry's current values read (`readCurrent`, then `typedData` with `ctx.current`) to describe a first setup, a
  change of password or recovery code (highlighted), customers added, changed or removed; deleting a wrap, or both
  wraps once set, refused; a new data key (version 2) only as the four keys together (both wraps, `GCRKeyEpoch`,
  `GCRKeyRing`) once the data is set up, highlighted. GasTrace's note says the signature authorizes the change.
- **GasTrace's validity** (version 2): `validFrom` at most 10 minutes ahead, `deadline - validFrom` at most 7 days, not
  expired. A field naming a key must be the account itself (`AcceptOwnership.newOwner`, `RecordDocument.signer`,
  `CancelNonces.signer`).
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
   the call is in the catalog, its `needs` hold, the daily caps (per account and overall), the gas cap; simulates (whatever the Key Manager or the target
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
- **access** (`UPRelay.ACCESS_PERMS` = `UPDeploy.DEVICE_PERMS` = `0x640800`): CALL with LSP6 **AllowedCalls**
  (`UPCatalog.allowedCalls(chainId)`: one entry per function of the catalog, call type CALL only, the contract's
  address or any address for the contracts made by a project's factory, the function's selector), SETDATA of its own
  name only (AllowedERC725YDataKeys), SIGN and EXECUTE_RELAY_CALL. The **account** refuses any other call from it,
  whether through the relay or sent directly by someone holding the key and paying the gas: no transfer of value or
  of tokens, no ownership handed over, no other contract, no profile, no keys (audit A01 / X-01;
  `test/creator.js` checks it on LUKSO's own contracts).

**What an access key can still do: sign.** LSP6 cannot limit SIGN: the account's `isValidSignature` (ERC-1271)
accepts what any key with SIGN signs (sign-ins to the projects' sites, for example). For GasTrace this is closed on
both sides: the extension refuses its requests from a computer with an access (the catalog's `signer: "admin"`,
checked in the window from this computer's permissions on the account), and version 2's registries accept an owner's
signature only from a key with EDITPERMISSIONS on the account (`isAdministrator`), whoever sends it. Clients are told
to authorize as access only their company's computers.

**Updating an access.** When a project adds an operation to the catalog, the access keys already authorized do not
have it in their allowed calls yet: the service lists them as `update: true` (`/api/profile/read`), and an
administrator's "Update" writes their permissions and allowed calls as the catalog's of today (`UPRelay.updateDevice`,
checked by the service: the key is an access of the account, the payload exactly the one `updateDevice` builds). An
access of 0.5.x (`UPRelay.OLD_ACCESS_PERMS`, SUPER_CALL) is updated the same way. Until then it loses nothing; only
the new operations are refused by the account.

The change (`UPRelay.addDevice`, `removeDevice`, `updateDevice`: the list of keys, the permissions, the name; for
access, its allowed data key and allowed calls) is signed by the administrator's key and sent over the relay; the service checks it against the account's
current list of keys on the network and rebuilds it byte for byte. The new computer finds the account by itself
(`/api/lookup` reads the keys on the network), then makes the backup copy naming it. The extension's page lists the
account's computers, with "Revoke" for the others (administrators only; a key cannot revoke itself), shows the
computers added or revoked since its last opening, and advises a second administrator while there is only one.

## 8. Open points

- **GasTrace `SetData`**: values are encrypted and signed as a hash; the window can say how many items change
  (counterparties and settings), not their content. The data key stays in the owner page, never in the extension.
- **The phone**: the same catalog in the Android app; for pages opened on a phone, WalletConnect or a direct link.
- **Accounts not created by the service** (existing Universal Profiles that authorize a ChainIntegrate key): not
  served by the relay today.
- **Reviews**: an independent technical review (November 2026) of this project and GasTrace; its findings for this
  repository are closed in 0.6.0 and 0.6.1 or decided by the maintainer ([../BACKLOG.md](../BACKLOG.md)).
