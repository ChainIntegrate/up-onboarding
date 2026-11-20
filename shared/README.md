# Shared code

What the extension, the account service, the web pages and (later) the Android app have in common, written and
reviewed once. Plain JavaScript with no browser or Android code: it runs in the browser (globals `UPRequest`,
`UPKeystore`, `UPDeploy`, `UPRelay`, `UPCatalog`, `UPIpfs`, after ethers 6) and in Node (`require`). The web pages
load copies in `web/lib/shared/` and the extension in `extension/shared/`, kept identical by `npm run sync` and
checked by the unit tests. Each file describes its own format at the top.

## `request.js`: an account's creation request

Everything needed to create a client's account, public data only: network, optional LSP23 salt, profile (name,
description, tags, links), images (as data URLs), the keys' addresses with a name and a role (`admin` or
`device`), and the date of the terms of service accepted (`terms`, optional). The extension writes it and the
account service creates from it; `web/operator.html` reads it too.

- `UPRequest.create(fields)` and `UPRequest.parse(object)` return `{ request, errors }`: the request with only
  the known fields, cleaned (addresses checksummed, names on one line without control or bidi characters,
  lengths capped, only `http(s)` links, PNG or JPEG only, the profile name's rule `NAME_RE`), and the problems as
  codes (`profile.name`, `controllers.1.address`, `controllers.noAdmin`, …). `parse` also checks `kind` and
  `version`.
- `UPRequest.signingMessage(request)`: what an administrator key signs to ask for the creation.
- `UPRequest.profileUpdate({ account, profile, images, keepPicture, at })` and `updateMessage(update)`: a new
  profile for an existing account, signed by one of its administrator keys; `at` dates it (the service serves each
  signed update once, within an hour).
- `UPRequest.TERMS`: the date of the current terms of service.
- `UPRequest.warnings(request)`: `controllers.oneAdmin` when there is only one administrator.

## `keystore.js`: the client's keys

- `generate()`: a new key (private key bytes and address).
- `passwordProblem(password)`: `null`, `"short"` or `"weak"`: at least 20 characters, or 14 mixing three kinds
  (lower case, upper case, digits, others); at least 8 different characters; no character 4 times in a row, no
  run of 6 consecutive letters or digits, not a short block repeated.
- `sealWithPassword(key, password)`: AES-256-GCM with a key from PBKDF2-SHA256, 600,000 rounds, for a password
  that passes `passwordProblem` (records sealed earlier with a shorter one still open).
- `sealWithSecret(key, secret, meta)`: AES-256-GCM with a key from HKDF-SHA256 of a device secret of at
  least 32 bytes, which each app obtains on its own: a passkey's PRF value in the extension, a key of the
  Android Keystore in the app. `meta` is the app's public data to obtain it again.
- `open(record, { password } | { secret })`, `withKey(record, unlock, fn)`: the key, checked against the
  record's address; `withKey` passes an ethers `SigningKey` and wipes the key afterwards.
- `backupFile(record, { name, account })`, `readBackup(file)`, `readBackupInfo(file)`: the backup file, a
  password record only (a key sealed with a device secret cannot leave the device), naming the account in clear
  once it exists.

The encryption's associated data binds each ciphertext to the record's format version, method and address.

## `deploy.js`: the account's creation

One `deployERC1167Proxies` call to LUKSO's `LSP23LinkedContractsFactory` through
`UniversalProfileInitPostDeploymentModule`: `UPDeploy.plan({ profileValue, controllers, salt, chainId })` gives what
is written (the profile, LUKSO's LSP1 delegate, each key's permissions and name; a `device` key with its allowed
calls, the catalog's on that network) and the call; `addresses(provider, plan)` the account and Key Manager it
creates; `verify(provider, plan, up, km)` reads the account back. `ADMIN_PERMS` and `DEVICE_PERMS` (= the
extension's access, `UPRelay.ACCESS_PERMS`).

## `relay.js`: operations sent by the account service (LSP25)

`UPRelay.digest(...)` is the hash a key signs for its Key Manager's `executeRelayCall`; `UPRelay.check(payload,
{ signer, chainId })` says what a payload does, or refuses it: the profile, the signer's own name, a call of the
catalog, a computer authorized (`addDevice`), revoked (`removeDevice`) or brought up to date (`updateDevice`).
Roles: `ADMIN_PERMS` (`0x7f3f06`) and `ACCESS_PERMS` (`0x640800`: CALL limited by AllowedCalls to the catalog's
functions, SETDATA of its own name, SIGN, EXECUTE_RELAY_CALL); `OLD_ACCESS_PERMS` is 0.5.x's access (SUPER_CALL),
brought up to date by `updateDevice`. Used by the extension to build and sign, and by the service to check before
sending.

## `catalog.js`: what the projects' pages may ask

The projects (GasTrace, TraceabilityRegistry, Supplier Trust Registry), their sites, and for each request the
plain words the confirmation window shows: `projectForOrigin`, `message` (sign-in messages), `typedData` (EIP-712:
GasTrace version 2), `call` (transactions through the relay), `verifyNeeds` and `readCurrent` (the on-chain checks
and values), `allowedCalls(chainId)` (an access key's LSP6 AllowedCalls). The extension and the service read the same
file, so they cannot disagree; [../docs/integration.md](../docs/integration.md) describes it.

## `ipfs.js`: storing on IPFS

`UPIpfs.add(api, bytes, { filename, type, auth })`: a file added and pinned on an IPFS node's write API (Kubo
`/api/v0/add`), its `ipfs://` URL returned. Used by the account service and the operator's page.
