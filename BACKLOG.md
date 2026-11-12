# Changes waiting for the next batch

Changes to the extension are collected here and made together, then one release (a new version: a released
version never changes, its SHA256SUMS are published). Changes to the pages and the service that come with them go
in the same batch. Remove an item when its release is done.

## In 0.3.0 (written and tested; released after the check on Testnet)

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

**Check before the release**: on Testnet, one account with a transparent PNG logo and one with a photo, both shown
with name and picture on Universal Everything; allow some minutes after the creation before judging (see item 4).

## Next

7. **The computer's name** (2026-11-12, asked by the maintainer). Today the field "Name of this computer" is on the
   ready screen; its value is written into the account (the controller's name, `UPWalletControllerName`) only at
   the creation, and an empty field writes the placeholder's example ("PC ufficio", as on the first test account).
   Changed after the creation it is kept on this computer only, although the label says "you will see it in your
   account". To do:
   - the computer's name in the "Create your account" form, next to the profile name, required, prefilled with
     a sensible value ("Computer"), never the placeholder used as a value;
   - after the creation, a label that says where the name is kept;
   - changing it in the account later: a data write signed by the key (see item 8).
8. **Changes to an existing account, gas paid by the service** (design): the computer's name, the profile (name,
   description, picture), a second device (the Android app, a second computer). Each is a data write through the
   account's Key Manager signed by one of its keys; the key holds no LYX, so the service would send it and pay
   (LSP25 `executeRelayCall`, signed by the key, sent by the service's wallet), with limits like the creation's.
   One mechanism for all of them, designed and tested once.

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
