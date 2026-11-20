# Android app (design, not written yet)

The phone counterpart of the [extension](../extension/): the client's keys on the phone (Android Keystore,
fingerprint or PIN), joining an account as one of its computers, and the confirmations for ChainIntegrate's services. Separate
from UP Wallet for Android; it uses the shared code in [`../shared/`](../shared/).

What is ready for it in this repository:
- the key store (`shared/keystore.js`): a key sealed with a secret the app obtains from the Android Keystore
  (method "secret"), and the same password-protected backup file as the extension;
- the creation's "device" role and the extension's "access" (`UPDeploy.DEVICE_PERMS` = `UPRelay.ACCESS_PERMS`):
  the catalog's calls only (CALL with LSP6 AllowedCalls, refused by the account itself otherwise), its own name, and
  SIGN (which LSP6 cannot limit; GasTrace's owner requests need an administrator's key, checked by its version 2
  registries and the catalog, see docs/integration.md section 7);
  no transfer of value or tokens, no profile, no keys;
- joining an existing account as a second computer does: the phone shows its code, an administrator authorizes
  it from the extension ("Your account's computers"), the account service finds the account (`/api/lookup`);
- the account service's relay and the projects' catalog (`shared/catalog.js`), the same as the extension's.
