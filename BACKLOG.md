# Changes waiting for the next batch

Changes to the extension are collected here and made together, then one release (a new version: a released
version never changes, its SHA256SUMS are published). Changes to the pages and the service that come with them go
in the same batch. Remove an item when its release is done.

## In 0.4.1 (released 2026-11-12)

The relay no longer depends on the computer's clock (found in the live test on LUKSO: the Key Manager refused with
`RelayCallBeforeStartTime`, the laptop's clock being ahead of the latest block). What the key signs is valid from 0
until ten minutes after the network's time, which the service gives with the nonce; the service also waits, up to a
minute and a half, for the network to reach a validity that starts later (0.4.0 extensions), and says by name why
the Key Manager refused.

## In 0.4.0 (released 2026-11-12)

Items 8 (the relay), 9 (the privacy notice from the extension) and 11 (the backup copy names the account), the
projects' catalog, the page provider and the confirmation window (docs/integration.md), the network read from
ChainIntegrate's node through the service. Next: the live test on LUKSO with this release; items 10, 12, 13.

## In 0.3.1 (released 2026-11-12)

0.3.0 was the Testnet check of items 1-4 (`chaintest-tre`: name, picture and description shown on Universal
Everything); 0.3.1 adds item 7, so the copy of 0.3.0 used for the check keeps matching its published SHA-256.

1. **Removing the access: a confirmation step.** After the checkbox, a confirmation that names the account and says
   plainly it cannot be undone and that without the backup the account is lost; "Cancel" has the focus.
2. **The profile name: lowercase letters, digits and hyphens, 3 to 32 characters, no hyphen at the start or the
   end** (`UPRequest.NAME_RE`, error `profile.nameRule`). The extension lowercases as you type, shows the rule
   under the field and keeps the button off until the name holds; the service refuses a request that breaks it,
   whatever extension sent it; the operator's page checks it too. The label says the company's full name goes in
   the description. Needed: a name with capitals and underscores leaves the profile anonymous on Universal
   Everything (item 5).
3. **The picture chosen again is sent**: the file field is cleared after each creation and whenever the form is
   shown again; "No picture" is written when there is none.
4. **PNG or JPEG, never WebP**: PNG when the picture has transparent pixels (a logo), JPEG otherwise, in the
   extension and the operator's page; the service refuses WebP (an older extension gets "check the picture").
   *Correction, 2026-11-12:* WebP was not the cause. `chaintest2`, with the same WebP picture, is shown with name,
   picture and description some minutes later: Universal Everything processes a new profile's picture with a
   delay, and shows the account as `#EOA` until then. The change stays (PNG and JPEG are the widest supported),
   but it is not a fix.

**Checked** on Testnet before the release (`chaintest-tre`, 0.3.0); allow some minutes after a creation before
judging what Universal Everything shows (item 4).

## Next

7. **The computer's name** (in 0.3.1): in the "Create your account" form, next to the profile name, required,
   prefilled with "Computer" (never the placeholder used as a value), written into the account at the creation;
   the ready screen says the name written in the account. The field that kept a name on the computer only is
   gone. Changing the name in the account later: item 8.
8. **Changes to an existing account, gas paid by the service** (design): the computer's name, the profile (name,
   description, picture), a second device (the Android app, a second computer). Each is a data write through the
   account's Key Manager signed by one of its keys; the key holds no LYX, so the service would send it and pay
   (LSP25 `executeRelayCall`, signed by the key, sent by the service's wallet), with limits like the creation's.
   One mechanism for all of them, designed and tested once.

9. **The privacy notice from the extension** (2026-11-12; *done in 0.4.0*): `web/privacy.html` is published and
   linked from the client's page and from the extension's footer; updated for 0.4.0 (the relay, the projects' sites,
   LUKSO's public node).

10. **Device keys cannot use the relay** (2026-11-12): the "device" permissions (`UPDeploy.DEVICE_PERMS`, as
    Cross_Chain's "Authorize a device") lack EXECUTE_RELAY_CALL, which LSP25 requires. Today every extension key is
    an administrator, so it does not matter; before a phone (the Android app) is added as a device, give device
    keys EXECUTE_RELAY_CALL (new accounts) and decide how existing ones get it.

11. **The backup copy names the account** (2026-11-12, asked by the maintainer; *done in 0.4.0, required*). The backup holds only the key
    (encrypted) and its address: the account itself needs no backup (it lives on the network and the key controls
    it), but after a restore the extension finds which account through the service (`/api/lookup`). If the service
    were down or gone, the key would still work but the extension would not know its account. To do in 0.4.0:
    - a backup made after the creation also holds the account's address and network, in clear (public data,
      outside the encrypted part, not trusted for anything but finding the account; checked on-chain: the key must
      be among the account's controllers);
    - after the creation, a new backup copy naming the account is **required** (decided by the maintainer), as
      at the first setup: made and checked before anything else; accounts created before 0.4.0 are brought to the
      same required step; the earlier copy is not accepted in its place;
    - on a restore, the address in the file first (confirmed with the service when it answers: if the service
      knows another account for the key, its answer wins and a new copy is required), the service as a fallback;
    - the account's address shown and copiable on the ready screen.

12. **The projects' pages offer ChainIntegrate Account** (2026-11-12; in each project's repository). The extension
    announces itself with EIP-6963 on the projects' sites; TraceabilityRegistry and Supplier Trust still look only for
    `window.lukso` and WalletConnect. Each page adds an EIP-6963 listener and offers "ChainIntegrate Account" next to
    the others; nothing else changes (same messages, same calls). Supplier Trust's sign-in names the domain from its
    backend: it must be the page's own host, or the extension refuses it (`other_site`).

13. **The gas cylinder registry in the catalog** (2026-11-12): its owner operations (EIP-712 `SetOperator`,
    `SetData`, `TransferOwnership`, `AcceptOwnership`) are in `shared/catalog.js`, refused until its site and
    `GasCylinderRegistryFactory` address are written there (decided in that project's conversation, after the
    drivers' app is published). Then: a release of the extension.

## Under investigation

5. **The first test account: metadata error on Universal Everything** (2026-11-12, Testnet,
   `0xd7a1Fc3D859c4a414075d029a9851B3c081635E6`, name `"Account_Chain_Test"`). `creator.js inspect`: the
   LSP3Profile value is right (VerifiableURI, keccak256 utf8), the JSON and the image are on the IPFS node and are
   served with the right hashes by LUKSO's gateway (`api.universalprofile.cloud`), the one Universal Everything
   uses. **Cause: the name.** More than 30 minutes later it is still `anonymous-profile#d7a1` (no name, no picture),
   while `chaintest2`, with the same WebP picture file, is shown in full: the one difference is the name
   (capitals, underscores). Item 2's rule is needed, not only a choice.
6. **The second account shows no profile picture** on Universal Everything (screenshot of 2026-11-12): checked,
   no picture reached the service (`0 profile image(s)`); LUKSO's index has the account as `chaintest#A9a9`.
   See item 3.
