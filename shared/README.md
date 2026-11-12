# Shared code

What the web page, the extension and the Android app have in common, written and reviewed once. Plain
JavaScript with no browser or Android code: it runs in the browser (globals `UPRequest`, `UPKeystore`, after
ethers 6) and in Node (`require`). The web pages load copies in `web/lib/shared/`, kept identical by
`npm run sync` and checked by the unit tests.

## `request.js`: the request file

Everything needed to create a client's Universal Profile, public data only: network, optional LSP23 salt,
profile (name, description, tags, links), images (as data URLs), the keys' addresses with a name and a role
(`admin` or `device`). The extension or the app writes it, `web/up-create.html` reads it.

- `UPRequest.create(fields)` and `UPRequest.parse(object)` return `{ request, errors }`: the request with only
  the known fields, cleaned (addresses checksummed, names on one line without control or bidi characters,
  lengths capped, only `http(s)` links, only raster images), and the problems as codes
  (`profile.name`, `controllers.1.address`, `controllers.noAdmin`, …). `parse` also checks `kind` and `version`.
- `UPRequest.warnings(request)`: `controllers.oneAdmin` when there is only one administrator.

The format is described at the top of the file.

## `keystore.js`: the client's keys

- `generate()`: a new key (private key bytes and address).
- `sealWithPassword(key, password)`: AES-256-GCM with a key from PBKDF2-SHA256, 600,000 rounds; at least 12
  characters.
- `sealWithSecret(key, secret, meta)`: AES-256-GCM with a key from HKDF-SHA256 of a device secret of at
  least 32 bytes, which each app obtains on its own: a passkey's PRF value in the extension, a key of the
  Android Keystore in the app. `meta` is the app's public data to obtain it again.
- `open(record, { password } | { secret })`, `withKey(record, unlock, fn)`: the key, checked against the
  record's address; `withKey` passes an ethers `SigningKey` and wipes the key afterwards.
- `backupFile(record, { name })`, `readBackup(file)`: the backup file, a password record only (a key sealed with
  a device secret cannot leave the device).

The encryption's associated data binds each ciphertext to the record's format version, method and address.
