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

2. **Rules for the profile name: lowercase letters only, no underscores** (2026-11-12, decided by the maintainer
   after the test on Testnet below). Universal Everything shows the name as a handle (`@chaintest#a9a9`); a name with
   capitals and underscores (`Account_Chain_Test`) gave a metadata error there, an all-lowercase one (`chaintest`)
   works. To do, everywhere the name is checked, so a wrong one never reaches the network:
   - `shared/request.js`: a rule for `profile.name` (a new error code), used by the extension, the service and
     the operator's page alike;
   - the extension: the rule shown under the field, checked while typing, the button disabled until it holds;
     the label says it is the profile's name (the company's full name goes in the description);
   - the service refuses a request that breaks it (400, plain message in the extension);
   - tests for each.
   To confirm before writing it: digits allowed? Hyphens? A minimum and maximum length (LUKSO's own tools: to
   check)?

## Under investigation

3. **The first test account: metadata error on Universal Everything** (2026-11-12, Testnet,
   `0xd7a1Fc3D859c4a414075d029a9851B3c081635E6`, name `"Account_Chain_Test"`). `creator.js inspect`: the
   LSP3Profile value is right (VerifiableURI, keccak256 utf8), the JSON and the image are on the IPFS node and are
   served with the right hashes by LUKSO's gateway (`api.universalprofile.cloud`), the one Universal Everything
   uses. The second account, `chaintest`, shows its name and description: the cause is the name (item 2).
4. **The second account shows no profile picture** on Universal Everything (screenshot of 2026-11-12): to check
   whether a picture was given and, if so, where it stops (`creator.js inspect`).
