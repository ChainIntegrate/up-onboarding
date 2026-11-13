# Android app (design)

The phone counterpart of the [extension](../extension/): the client's keys on the phone (Android Keystore,
fingerprint or PIN), the request file for the operator, and signatures for ChainIntegrate's services. Separate
from UP Wallet for Android; it uses the shared code in [`../shared/`](../shared/).

What is ready for it in this repository:
- the key store (`shared/keystore.js`): a key sealed with a secret the app obtains from the Android Keystore
  (method "secret"), and the same password-protected backup file as the extension;
- the creation's "device" role and the extension's "access" (`UPDeploy.DEVICE_PERMS` = `UPRelay.ACCESS_PERMS`):
  signs, uses the projects' operations through the relay, changes its own name; no transfer of value, no profile,
  no keys;
- joining an existing account as a second computer does: the phone shows its code, an administrator authorizes
  it from the extension ("Your account's computers"), the account service finds the account (`/api/lookup`);
- the account service's relay and the projects' catalog (`shared/catalog.js`), the same as the extension's.
