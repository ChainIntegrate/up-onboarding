# The account service

ChainIntegrate in LUKSO's place, as LUKSO's relayer does for Universal Everything: it creates a client's account when
their extension asks, with an invitation code, and sends the operations one of the account's keys signs, paying the
gas with its own wallet. It also reads the network for the extension from ChainIntegrate's node. Node.js, one file
(`creator.js`), ethers as its only dependency, behind nginx at `/api/` (127.0.0.1:8811). The service's wallet and
ChainIntegrate have **no key and no permission** on the accounts: they belong to the clients' keys only.

## Endpoints

| | |
|---|---|
| `GET /api/health` | `{ ok, network, extension: { version, download } }`: the network and the latest released extension |
| `POST /api/create` | a new account (below) |
| `POST /api/lookup { address }` | the account a key controls today, among the accounts this service created, read on the network (a key authorized later is found, a revoked one is not); 10 per minute per address |
| `POST /api/relay/nonce { account, signer }` | the account's Key Manager, the signer's LSP25 nonce, the chain id, the network's time |
| `POST /api/relay { account, nonce, validity, payload, signature }` | an operation on the account, signed by one of its keys, sent and paid by the service (below) |
| `POST /api/profile { update, signature }` | a new profile stored on IPFS, asked by a key of the account, keeping the current picture when none is given; the extension then writes its value with the relay |
| `POST /api/profile/read { account, signer }` | the profile's name, description and picture, the signer's name and role, the account's computers and its list of keys (after a restore, and for "Your account's computers") |
| `POST /api/rpc` | reading the network for the extension (only reading methods, one call per request, logs over at most 100,000 blocks and one address, `rpcPerIpPerMinute`, nothing logged): the node's URL carries an access key, which public code cannot hold |

**Creation** (`/api/create { invite, request, signature }`):

1. **Limits**: requests per IP address per minute (`perIpPerMinute`), accounts per day in total (`maxPerDay`).
2. **The invitation code**: known, open, not expired. Codes are stored as SHA-256 hashes only.
3. **The request** (`shared/request.js`): cleaned and checked (the profile name's rule, PNG or JPEG); the network
   must be the service's; at most `maxControllers` keys, at least one administrator.
4. **The signature**: `personal_sign` of `UPRequest.signingMessage(request)` by one of the request's administrator
   keys: an account is created only for keys their owner holds.
5. **Creation**, one at a time: the picture and the profile to ChainIntegrate's IPFS node (`shared/ipfs.js`, Kubo's
   `/api/v0/add`, pinned), then asked from LUKSO's gateway (`warmGateways`) so Universal Everything's indexer finds
   them at once; the LSP23 call of `shared/deploy.js` with a random salt, sent by the gas wallet, refused while the
   wallet would fall under `minBalance`; the account read back (owner, Key Manager, keys, permissions, profile).
6. **The code** becomes `used`, with the account's address. If something fails after the transaction was sent, the
   code stays in `review` with the transaction (`invites`).

**Relay** (`/api/relay`, LSP25 `executeRelayCall`, `shared/relay.js`). Allowed, whoever signs:
- the profile (an IPFS VerifiableURI) and the signer's own name;
- a call in the projects' catalog (`shared/catalog.js`: `execute(CALL, target, 0, data)`), with its on-chain checks
  (e.g. "a registry made by the project's factory");
- a computer authorized or revoked (`UPRelay.addDevice`, `removeDevice`): checked against the account's current
  list of keys on the network and rebuilt byte for byte; a key cannot revoke itself, LUKSO's delegate cannot be
  removed.

Then: the account is one this service created; the request is valid for at most an hour (the key signs a validity
until ten minutes after the network's time; a validity that starts after the latest block is waited for, up to a
minute and a half); a simulation, so whatever the Key Manager refuses (a stranger's key, an access key changing the
profile or the keys, a used nonce) costs nothing and is answered with its reason by name (`NotAuthorised`,
`NoPermissionsSet`, `InvalidRelayNonce`, ...); `maxRelayPerDay` for the whole service (200, with an alert e-mail when
reached) and `relayPerIpPerMinute` (20). Each operation sent is logged in `relay.jsonl` (account, signer,
operation, transaction, outcome); a refusal is logged in the journal.

## Commands

```bash
node creator.js invite --note "Rossi Srl"   # a new code, printed once, and the link to send the client:
                                            #   https://account.chainintegrate.it/#invito=<code> (siteUrl)
node creator.js invite --days 7             # one that expires sooner (default: inviteDays, 30)
node creator.js invites                     # id, state, dates, account, note
node creator.js revoke <code or id>         # an open code that may no longer be used
node creator.js status                      # network, gas wallet, balance, accounts and operations today
node creator.js inspect <account>           # the profile: its value on the network, the JSON and the picture on the
                                            #   IPFS node and public gateways, LUKSO's index (Universal Everything)
node creator.js withdraw 0x… [amount]       # the gas wallet's LYX to an address of yours (all of it: nothing left)
node creator.js backup                      # a dated copy of the data folder (every night by the timer)
node creator.js rebuild [--dry-run]         # the list of created accounts rebuilt from the network
```

The gas wallet's key stays on the server (`gasKeyFile`): the service is the only one that uses it, and `withdraw`
takes the LYX back without it leaving the server. Never use that address for anything else.

With `CREATOR_CONFIG=/etc/up-onboarding/config.json` (the service's) and as the service's user, so the files keep
their owner: `sudo -u up-onboarding CREATOR_CONFIG=/etc/up-onboarding/config.json node creator.js invite`.

## Alerts

`alert.js`, by e-mail through the same mailbox as Cross_Chain's relayer monitor (`smtp.env.example`):

- `failed <unit>`: systemd gave up restarting the service (5 restarts in 10 minutes; `OnFailure=` starts
  `up-onboarding-alert@.service`);
- `check`, every 10 minutes (`up-onboarding-creator-check.timer`): the service answers at `/api/health`, the gas
  wallet holds more than `minBalance` + 0.1, no code is in `review` (or `creating` for more than 15 minutes), the
  relay's daily cap is not reached, the nightly backup is there (at most 26 hours old).
  An e-mail when a problem appears, every 6 hours while it lasts, and when it is solved;
- `test`: a test e-mail.

## Configuration

`config.example.json`; paths relative to the configuration file.

| Key | |
|---|---|
| `network`, `chainId` | `lukso` (42) or `lukso-testnet` (4201) |
| `rpcFile` or `rpc` | the network's node. `rpcFile`: a file (one line, mode 640, group `up-onboarding`) with the URL of ChainIntegrate's node, `https://rpc.chainintegrate.it/rpc/<key>`, with an access key for this service only; its URL is never logged or sent in alerts. `rpc`: a plain URL (LUKSO's public node, tests) |
| `rpcPerIpPerMinute` | `/api/rpc`, the extension's reading of the network through this service (only reading methods, one call per request; logs over at most 100,000 blocks and one address): per-address limit (120) |
| `gasKeyFile` | the gas wallet's private key, one line, mode 600: a wallet used only for this, with little LYX |
| `ipfsApi` | the IPFS node's write API, `http://<node>:5001`: the same value as `IPFS_API_URL` in the other ChainIntegrate backends on this server (traceability-registry, supplier-trust-registry). The node's firewall accepts only allowed servers; no secret in the address |
| `ipfsAuthFile` | optional: an `Authorization` header value, one line, mode 600, when the node's API is behind a proxy that asks for one |
| `dataDir` | the codes (`invites.json`), the created accounts (`created.jsonl`: the relay serves only these), the relay's log (`relay.jsonl`) |
| `maxPerDay`, `perIpPerMinute`, `maxControllers`, `inviteDays` | 20, 1, 5, 30 |
| `minBalance` | the gas wallet's floor, in LYX (0.05) |
| `maxRelayPerDay`, `relayPerIpPerMinute` | the relay's daily cap for the whole service and its per-address limit (200, 20) |
| `confirmSeconds` | how long to wait for the transaction (180) |
| `siteUrl` | the client's page, for the invitation links (`https://account.chainintegrate.it/`) |
| `warmGateways` | public IPFS gateways asked for a new profile and picture before the value is written on the account, so LUKSO's indexer (Universal Everything) finds them at once (`["https://api.universalprofile.cloud/ipfs/"]`) |
| `backupDir`, `backupKeep` | where `creator.js backup` keeps its dated copies of the data folder, and how many (`/var/backups/up-onboarding`, 30) |
| `explorerApi` | LUKSO's explorer (Blockscout API v2), read only by `creator.js rebuild` (the mainnet or testnet explorer by `network`) |

A creation costs about 0.01 LYX with the profile on IPFS. Installation: [../../DEPLOY.md](../../DEPLOY.md).
Tests: `npm run test:creator` (a local chain with LUKSO's contracts, the IPFS API answered locally).

## Backup and recovery

`dataDir` holds the codes (`invites.json`), the created accounts (`created.jsonl`: the relay serves only these) and
the relay's log. Every night `up-onboarding-backup.timer` runs `creator.js backup`: a dated `.tar.gz` in `backupDir`,
readable by the service only, the latest 30 kept; `alert.js check` sends an e-mail when the latest is older than 26
hours. To restore one: stop the service, `sudo tar -xzf <copy> -C /var/lib/up-onboarding`, start it.

Without any copy, `creator.js rebuild` rebuilds `created.jsonl` from the network: LUKSO's explorer lists the gas
wallet's transactions, each creation is read back (the account, its Key Manager, its keys) and checked on the network
(the account owned by its Key Manager), and the accounts missing from the list are added (`--dry-run`: only listed).
The accounts themselves never depend on these files: they live on the network and in the clients' extensions.
