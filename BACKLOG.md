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
    own host, or the extension refuses it (`other_site`); the projects' sign-in messages must be issued when they
    are signed (`Issued At` within 15 minutes, 0.6.0).
15. **Live tests on LUKSO still to make** (with the released extension, Argonia's demo account
    `0xC335aFd1d95fA790DE419e9BCe482d9B8BC1D773`):
    - GasTrace version 2: connect, then the owner's requests on a registry made by the factory V2
      `0xd60146C03f288fCeEEdB90731f162fF57F7ebdd2` (with 0.6.1);
    - a second computer with its own key: join, authorize as access (allowed calls, 0.6.0) and as administrator,
      "Update", revoke;
    - TraceabilityRegistry and Supplier Trust sign-ins and operations, after item 12.
16. **The Android app** ([android/](android/)): the same flows as the extension on the phone, its key in the
    Android Keystore. The creation's "device" role is ready for it (item 10); it joins an existing account as a
    second computer does (0.5.0).
18. **The Chrome Web Store** (even unlisted): Chrome then verifies the extension's files, updates it and syncs it
    between the client's computers. The extension's ID is already fixed for it (`manifest.json` `key`). Also asked by
    the review of 2026-11-20 before real data (X-04, accepted until the clients are many).
19. **The review of 2026-11-20** (verification of GasTrace version 2 and extension 0.6.1, `e0f6fbe`): no High or
    Medium issue; R-01 (X-01 / A01) fixed by version 2, R-07 closed. To fix here, each with the maintainer's consent:
    - **N-01** (Low): the owner's `RecordDocument` is described with one fixed sentence, whatever it does (one
      signature can create cylinders and rewrite several). As for `SetData`: the page sends the payload at the
      request's top level, the window recomputes `hashPayload`, refuses a mismatch and states the counts (cylinders
      corrected, new cylinders, documents); owner documents it cannot describe are refused. Needs GasTrace's page.
    - **R-03** (Low): `dataValues` still optional for `SetData` (and the new data key): without them the window
      warns "content not verifiable" and lets the owner confirm. Make them required once GasTrace's page always
      sends them (it does since 0.5.1).
    - **R-02** (Low): README and `docs/integration.md` say an access key reaches "no other contract": its allowed
      calls are the catalog's functions on any address for the contracts made by a project's factory. Say it as it is.
    - **R-05** (Low): the `/api/rpc` origin check is described as a restriction; it is checked from a header that
      only browsers set honestly. Say it as it is in the README.
    - **R-08** (Info): no postal or PEC address in the privacy notice: left out by the maintainer's decision
      (2026-11-20).
    - **U-09**: mitigated (a second administrator advised) and accepted; an optional recovery stays a decision for
      before real clients.
    For GasTrace's conversation (its repository): N-02 (identifiers after a data key change), N-03 (handover alerts
    across relayer restarts), N-04 and N-05 (information), R-04, R-06, A07, R02, A10, P-01 (compliance kit).

## Next extension version

- Nothing yet.

## Release history

### 0.6.1 (released 2026-11-20)

GasTrace version 2 (asked from the GasTrace conversation, 2026-11-20): the factory V2
`0xd60146C03f288fCeEEdB90731f162fF57F7ebdd2`, domain version `2`; every request with `validFrom` and `deadline`
(`validFrom` at most 10 minutes ahead, at most 7 days long); `TransferOwnership` described as a start completed after
3 days and cancellable, `CancelOwnershipTransfer`, `AcceptOwnership` for this account only, `RecordDocument` (the
owner's own corrections) and `CancelNonces` (its own requests); `SetData` with a new data key (both wraps,
`GCRKeyEpoch`, `GCRKeyRing`, together, once set up). Version 1's requests are no longer served. The registry now
checks the administrator too (`isAdministrator`): audit A01 / X-01 closed for GasTrace. GasTrace's
`scripts/admin-demo.js` passes with this catalog (11 requests checked).

### 0.6.0 (released 2026-11-16)

Left from 0.5.x, done here: this computer's name read from the account at each opening; the restore screen says
restoring is for a computer that replaces the previous one; the password field inside the computers' confirmations;
the welcome text's step 3 (the invitation code); the guide in the extension's footer. The guide's screenshots made
again, and the guide says "Update" exists.

The access role (audit A01 / X-01, D-07; maintainer's decisions 2026-11-15):
- **CALL with AllowedCalls instead of SUPER_CALL** (`UPRelay.ACCESS_PERMS` = `UPDeploy.DEVICE_PERMS` = `0x640800`):
  an access key may call only the catalog's functions (`UPCatalog.allowedCalls`), enforced by the account itself,
  also without the service; no transfer of value or tokens, no ownership handed over. `test/creator.js` checks on
  LUKSO's own contracts what an access key cannot do when it sends the call itself.
- **"Update"** in "Your account's computers": an access whose allowed calls are not the catalog's of today (a project's
  new operation) or an access of 0.5.x is listed as such, and an administrator brings it up to date
  (`UPRelay.updateDevice`, the service checking it). Revocations clear the allowed calls; 0.5.x's are still accepted.
- **GasTrace from an administrator's computer only**: SIGN cannot be limited, and GasTrace accepts any signature its
  owner account accepts; the confirmation window reads this computer's permissions and refuses GasTrace's requests
  from an access. GasTrace stays as it is for the demo (its demo account has administrator keys only); if adopted,
  its next factory checks the signer's role on its side (decision in GasTrace's conversation, 2026-11-15).
- The role described as it is (extension, guide, README, docs/integration.md, the operator's page); the operator's
  page no longer sends LYX to the client's keys.

The audit's Medium findings (maintainer's consent 2026-11-15, all together):
- **U-01, A13**: limits per account (operations, profiles stored), a gas cap per operation; a profile stored only for
  an administrator key, each signed update once, within an hour.
- **U-02**: the invitations page signs in with SIWE, an administrator key of the operator's account, 2-hour sessions
  for one browser, an e-mail at each sign-in.
- **U-10**: "ChainIntegrate will never ask you to authorize a computer"; one more confirmation for an administrator;
  the computers added or revoked since the last opening, until "Seen". No e-mail (maintainer's choice).
- **A14, U-05**: passwords as GasTrace's (20 characters, or 14 mixed; no repetitions or sequences). The backup keeps
  naming its account: the key's address is in clear anyway.
- **A18**: the creation's transaction journaled before it is sent, finished at the next start.
- **A15**: the node's chain id asked to the node (service: at the start and every 10 minutes, stopping on another
  network; alert.js; the extension before using a node).
- **A17, Q-02**: the service on ethers 6.17.0, no advisory left; the rest is test tooling (Hardhat 2), triaged.
- **P-02, A20, I-04, X-03**: the privacy notice completed (controller Simone Cavalletti as ChainIntegrate, legal
  bases, retention, third parties, what the code guarantees, IP kept at most two minutes); DEPLOY.md keeps the
  journal 30 days.
- **U-12**: said in the privacy notice and the terms: that an account was made through ChainIntegrate is public;
  neutral names for discretion (maintainer: a minor issue, said clearly).
- **U-13**: the terms of service (`web/termini.html`, approved by the maintainer 2026-11-15, as the privacy notice),
  accepted in the extension before the creation (`UPRequest.TERMS` sent and kept with the account); the extension
  says when they change.

The audit's Low findings (maintainer's consent 2026-11-15):
- **U-14, A19**: the integrity check is "ok" only with every code file listed once; else "unknown".
- **U-07**: a request left behind (no window, or older than 15 minutes) no longer blocks its site; two at once are
  taken in turn.
- **U-06**: sign-in messages issued within 15 minutes, no later start, an expiry at most 7 days away (the projects'
  messages do not all carry one).
- **U-03**: `/api/rpc` only for the extension's origin, 60 a minute per address.
- **U-04**: the operator page never stores the IPFS authorization.
- **U-08**: an invitation named by its id in the journal; today's relay count in memory; a key's likely account
  read first. Backups stay on the server, unencrypted, by the maintainer's decision (2026-11-12).
- **U-11**: after the check, move the backup copy off the computer; a reminder after six months.
- **Q-03, D-04**: a release runs every suite. **D-01, D-02, D-03, D-05**: the documents fixed; `?lang=` in a link
  wins, the toggle's choice then kept. **A22**: where the tests run, written in the README.
- **I-02**: nothing set on the pages' window. **I-03**: the guide says the offline check is skipped.
- **U-09** (High): one administrator only: the extension advises a second administrator computer, never required,
  "Later" for 30 days; no recovery by ChainIntegrate (maintainer's decision). **I-06**: support stays on Telegram,
  with the e-mail next to it on the pages and in the extension.
- Not changed, by the maintainer's decision: **X-04** (side-loaded extension, until clients are many: item 18) and
  **X-05** (one server, while the volume is small).

### 0.5.1 (released 2026-11-14)

GasTrace's data requests (audit A02 / G-04, asked from the GasTrace conversation, 2026-11-14):
- `SetData`: each data key classified (the data password's and the recovery code's wraps, the company's settings,
  a customer or refill centre, the collection's public description); any other key refused. The request's values
  (top-level `dataValues`, sent by GasTrace's page) are checked against the signed `dataValuesHash`; without them
  the request is accepted with a highlighted "content not verifiable" warning (transition, to be made required).
  The window reads the registry's current values (`UPCatalog.readCurrent`, then `typedData` with `ctx.current`) to
  tell a first setup from a change: both wraps only the first time, never deleted; customers added, changed or
  removed. Fixed line: the values are encrypted, the window shows the kind of change.
- Handing the registry over in red; GasTrace's own note under its requests ("With this confirmation you authorize
  this change of the registry; GasTrace's service records it") instead of "your account does not change"; the
  validity shown; requests valid for more than 7 days refused (G-07 / U-06).

### Pages, after 0.5.0 (no new extension version)

- **The guide** (`web/guida.html`, asked by the maintainer 2026-11-13): every step for the client in Italian and
  English, with the extension's button names; linked from the client's page and from the invitation message. The
  extension's footer will link it in its next version. Its screenshots (`web/guide/<lang>/`, 11 per language) are
  made from the extension itself with example data by `node tools/guide-screenshots.js`: run it again after any
  change to the extension's screens, and check the guide's text still matches.

### 0.5.0 (released 2026-11-13)

- **Invitation links** (pages and service): `creator.js invite` also prints the link to send the client,
  `https://account.chainintegrate.it/#invito=<code>`; the client's page shows the code with "Copy". The code is
  after "#", which the browser never sends to the server, so it is in no server log.
- **The invitations page** (`web/invites.html`, item 19, asked by the maintainer 2026-11-13): ChainIntegrate signs
  in once with an account listed in the service's `operators` (a signature, ERC-1271 for an account; a session of 8
  hours), makes an invitation (note, expiry) and gets the message to send the client in Italian or English (link
  and code, no crypto term), lists the codes and revokes an open one; at most `maxInvitesPerDay` a day, each action
  in the journal with its operator. Part of the security review (item 17).
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
