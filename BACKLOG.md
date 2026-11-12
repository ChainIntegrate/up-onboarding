# Changes waiting for the next batch

Changes to the extension are collected here and made together, then one release (a new version: a released
version never changes, its SHA256SUMS are published). Changes to the pages and the service that come with them go
in the same batch. Remove an item when its release is done.

## Extension

1. **"Remove the access from this computer": a confirmation step** (2026-11-12, from the maintainer's test on
   Testnet). Today the checkbox "I have the backup copy and its password" enables the button, and one click
   removes the access. The removal cannot be undone on this computer (only a restore from the backup brings it
   back), so a second, explicit confirmation before it happens: e.g. a window that names the account and says
   plainly that without the backup file and its password the account is lost, with "Remove" and "Cancel"
   (the default). Tested in `test/extension.js`.

2. **Rules for the profile name: lowercase letters only, no underscores** (2026-11-12, decided by the maintainer).
   Universal Everything shows the name as a handle (`@chaintest#a9a9`). First thought to be the cause of the first
   account's metadata error; the third test (item 4) points at the picture instead, so the rule is the
   maintainer's choice, not a proven requirement. Digits work (`chaintest2` indexed). To do, everywhere the name is checked, so a wrong one never reaches the network:
   - `shared/request.js`: a rule for `profile.name` (a new error code), used by the extension, the service and
     the operator's page alike;
   - the extension: the rule shown under the field, checked while typing, the button disabled until it holds;
     the label says it is the profile's name (the company's full name goes in the description);
   - the service refuses a request that breaks it (400, plain message in the extension);
   - tests for each.
   To confirm before writing it: digits (they work)? Hyphens? A minimum and maximum length?

3. **The picture chosen again is not sent** (2026-11-12, the second test account, `chaintest`: `inspect` shows
   `0 profile image(s)` in its JSON). After an account is created the extension forgets the picture
   (`avatar = null`) but leaves the file field as it was; choosing the same file again fires no `change` event, so
   the next request leaves without a picture while the field looks filled in. To do: clear the field with the
   picture (and whenever the form is shown again, e.g. after "Remove the access"), and show plainly whether a
   picture will be sent (the preview, or "no picture"). Test: create, remove, create again with the same file.
   *Confirmed by the maintainer (2026-11-12): the same file was chosen again.*
4. **The picture's format: JPEG, not WebP** (2026-11-12, the third test account). The likely cause of both failures
   on Universal Everything. Three accounts on Testnet:

   | Account | Name | Picture | Universal Everything |
   |---|---|---|---|
   | `0xd7a1…35E6` | `Account_Chain_Test` | WebP 512×512 | metadata error |
   | `0xA9a9…d4Fe` | `chaintest` | none (item 3) | shown, at once |
   | `0x7793…41e3` | `chaintest2` | the same WebP | shown as `#EOA`, no name |

   In every case `inspect` finds the JSON and the picture with their hashes on LUKSO's gateway, and LUKSO's index
   has the name (`chaintest2#7793`). The one account that works is the one without a picture: Universal
   Everything's own image processing probably fails on WebP and drops the profile. Checked: the file on IPFS is WebP
   (`RIFF…WEBP`), although the maintainer chose a PNG: the extension re-encodes every picture
   (`toDataURL("image/webp")`). To do, in the extension and the operator's page: a picture with transparent pixels
   (a logo) stays PNG, one without (a photo) becomes JPEG; never WebP. Then a Testnet account with a valid name and
   each kind of picture, shown on Universal Everything, before the release. To rule out a delay first:
   `chaintest2` still `#EOA` ten minutes later.

## Under investigation

5. **The first test account: metadata error on Universal Everything** (2026-11-12, Testnet,
   `0xd7a1Fc3D859c4a414075d029a9851B3c081635E6`, name `"Account_Chain_Test"`). `creator.js inspect`: the
   LSP3Profile value is right (VerifiableURI, keccak256 utf8), the JSON and the image are on the IPFS node and are
   served with the right hashes by LUKSO's gateway (`api.universalprofile.cloud`), the one Universal Everything
   uses. Likely cause: the WebP picture (item 4), not the name.
6. **The second account shows no profile picture** on Universal Everything (screenshot of 2026-11-12): checked,
   no picture reached the service (`0 profile image(s)`); LUKSO's index has the account as `chaintest#A9a9`.
   See item 3.
