# Backlog and release history

Changes to the extension are collected and made together, then released as one new version: a released version
never changes (its SHA256SUMS are published), so every change needs a new version. Changes to the pages and to the
account service that come with them go in the same batch. Item numbers are kept from the first list, so commits
and conversations that cite them stay readable.

## Open

12. **The projects' pages offer ChainIntegrate Account** (2026-11-12; in each project's own repository). The
    extension announces itself with EIP-6963 on the projects' sites. GasTrace's admin page already finds it;
    TraceabilityRegistry and Supplier Trust still look only for `window.lukso` and WalletConnect: each page adds an
    EIP-6963 listener and offers "ChainIntegrate Account" next to the others, nothing else changes (same messages,
    same calls). Supplier Trust's sign-in message names the domain given by its backend: it must be the page's
    own host, or the extension refuses it (`other_site`).
15. **Live tests on LUKSO still to make** (with the released extension, Argonia's demo account
    `0xC335aFd1d95fA790DE419e9BCe482d9B8BC1D773`):
    - GasTrace: connect, then the owner's requests on the demo registry `0xEae1a8B84977694e5c9925028a23599bc345b801`;
    - a second computer with its own key (0.5.0): join, authorize as access, revoke;
    - TraceabilityRegistry and Supplier Trust sign-ins and operations, after item 12.
16. **The Android app** ([android/](android/)): the same flows as the extension on the phone, its key in the
    Android Keystore. The creation's "device" role is ready for it (item 10); it joins an existing account as a
    second computer does (0.5.0).
17. **Security review**, when the changes are nearly complete (maintainer's decision, 2026-11-12): the extension
    (provider, confirmation window, key store), the account service (relay, catalog checks, device changes) and
    the catalog.
18. **The Chrome Web Store** (even unlisted): Chrome then verifies the extension's files, updates it and syncs it
    between the client's computers. The extension's ID is already fixed for it (`manifest.json` `key`).

19. **Invitations from the operator's page** (2026-11-13, maintainer: later, when clients are more than a few): a
    section of `operator.html` to make an invitation (note, expiry) and get its link, list the codes (state,
    account created) and revoke one, instead of `creator.js invite` over SSH. The service would accept it only
    signed by a ChainIntegrate key listed in its configuration, with a daily limit and every action logged; part of
    the security review (item 17).

## Release history

### 0.5.0

- **Invitation links** (pages and service): `creator.js invite` also prints the link to send the client,
  `https://account.chainintegrate.it/#invito=<code>`; the client's page shows the code with "Copy". The code is
  after "#", which the browser never sends to the server, so it is in no server log.
- **A computer per key** (items 8 and 10). On a new computer, "Add this computer to an existing account": its own
  key, protected and backed up as a new access, its code shown in groups of 4. On a computer that has the account
  (an administrator), "Your account's computers": the list (name, role, this computer), "Authorize another
  computer" (its code, a name, administrator or access) and "Revoke" for the others, each confirmed on the page and
  sent over the relay, the service paying (`UPRelay.addDevice`, `removeDevice`: the service checks the account's
  current list of keys on the network and rebuilds the payload byte for byte). The new computer finds the account
  by itself (`/api/lookup` reads the keys on the network: authorized keys are found, revoked ones are not), then
  the backup copy naming it is required.
- **Roles** (maintainer's decision, 2026-11-13): administrator as at the creation; access = SIGN,
  EXECUTE_RELAY_CALL, SUPER_CALL (the relay allows only the catalog's calls) and SETDATA of its own name only: no
  transfer of value, no profile, no keys. The creation's "device" role (operator page, Android) is the same as
  access (`UPDeploy.DEVICE_PERMS` = `UPRelay.ACCESS_PERMS`). Devices made before keep their old permissions and can
  be revoked.
- **The confirmation window's words** (item 14): what the operation does, never costs, payments or what is written,
  in both languages; tests check every description of the catalog and the confirmation windows for crypto terms,
  costs and payments.

### 0.4.3 (released 2026-11-13)

GasTrace (gas-cylinder-registry) is served (item 13): its site `gastrace.chainintegrate.it` and its factory
`0xA128e7162fa8Dc779bf31EF569F06B53a499A50e` on LUKSO are in the catalog; the owner's four EIP-712 requests
(`SetOperator`, `SetData`, `TransferOwnership`, `AcceptOwnership`) are signed in the confirmation window, for
registries made by that factory only. Its admin page was checked against the catalog in its own repository
(`scripts/admin-demo.js`, 6 requests of 6 accepted).

### 0.4.2 (released 2026-11-13)

Found in the live test on LUKSO:
- after a restore the extension knew only the key and the account: it now reads the profile's name, description
  and picture and this computer's name from the account (`/api/profile/read`);
- Universal Everything kept "anonymous-profile" after a creation or a change: its indexer fetches the new profile
  from LUKSO's gateway as soon as the account changes and does not retry, and a file just added to ChainIntegrate's
  node is not found there yet. The service now asks that gateway for the new profile and picture (`warmGateways`)
  before the value is written on the account (server side: works with every version).

Also in the service: a full `withdraw` leaves nothing in the gas wallet (a fixed gas price).

### 0.4.1 (released 2026-11-12)

The relay no longer depends on the computer's clock (the Key Manager refused with `RelayCallBeforeStartTime`, the
laptop's clock being ahead of the latest block): the key signs a validity from 0 until ten minutes after the
network's time, which the service gives with the nonce; the service waits, up to a minute and a half, for the
network to reach a validity that starts later (0.4.0 extensions), and says by name why the Key Manager refused.
The update notice downloads the latest zip directly.

### 0.4.0 (released 2026-11-12)

- The relay (item 8): the profile and the computer's name changed from the extension, the gas paid by the service
  (LSP25 `executeRelayCall`).
- The backup copy names the account (item 11): after the creation a new copy naming the account is required; a
  restore finds the account from the file, the service confirming it.
- The projects' catalog (`shared/catalog.js`), the page provider (EIP-6963) and the confirmation window
  (`docs/integration.md`).
- The network read from ChainIntegrate's node through the service (`/api/rpc`), LUKSO's public node as the
  fallback.
- The privacy notice linked from the extension (item 9).

Service, at the same time: a nightly backup of its data, an alert when it is missing, `creator.js rebuild` (the
list of accounts rebuilt from the network).

### 0.3.1 (released 2026-11-12)

Checked on LUKSO Testnet before the release (`chaintest-tre`):
1. removing the access asks for a confirmation that names the account, "Cancel" focused;
2. the profile name: lowercase letters, digits and hyphens, 3 to 32 characters, no hyphen at the start or the end
   (`UPRequest.NAME_RE`), checked by the extension, the service and the operator's page: a name with capitals and
   underscores left the profile anonymous on Universal Everything;
3. the picture chosen again is sent (the file field is cleared after each creation);
4. PNG or JPEG, never WebP (PNG when the picture has transparent pixels);
7. the computer's name in the creation form, written into the account.

Notes from that test: Universal Everything shows a new profile only after its indexer has read it; see 0.4.2 for
the cause of the profiles that stayed anonymous.

### 0.2.0 (released 2026-11-12)

The access, the required backup copy, the restore, and the creation of the account with an invitation code.
