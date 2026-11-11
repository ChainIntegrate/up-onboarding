# Browser extension (design)

A browser extension for the client, much simpler than UP Wallet for the browser: no WalletConnect, no dApps,
no networks other than LUKSO.

Planned:
- **Keys.** At first start it creates two keys: the daily one (encrypted on the computer with a passkey, or a
  password where no passkey works) and a backup administrator, exported once as an encrypted file for the
  client to keep elsewhere.
- **Request.** It produces the request file for `web/up-create.html` (the keys' addresses and roles, the
  profile), to send to the operator.
- **Use.** It shows the client's profile and signs only for ChainIntegrate's services, each request explained
  in plain words.

The key storage and the signing code live in [`../shared/`](../shared/), shared with the Android app.
