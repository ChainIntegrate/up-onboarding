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

## Under investigation

2. **Universal Everything shows a metadata error for a profile created by the service** (2026-11-12, Testnet,
   account `0xd7a1Fc3D859c4a414075d029a9851B3c081635E6`, name `"Account_Chain_Test"`). Checked with
   `creator.js inspect`: the LSP3Profile value is right (VerifiableURI, keccak256 utf8), the JSON and the image are
   on the IPFS node and are served with the right hashes by LUKSO's gateway (`api.universalprofile.cloud`), the one
   Universal Everything uses. So the data is valid; the problem is where Universal Everything reads it (LUKSO's
   profile index) or a rule of its own. Suspects: the name's characters (underscores, capitals); the index not yet,
   or not again, processing the profile. Next: the index's answer (`inspect` now asks it), the exact error shown,
   and a second account with an all-lowercase name. If it is the name, the extension checks it before creating.
