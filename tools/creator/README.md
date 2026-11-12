# The creation service

Creates a client's account as soon as their extension asks, with an invitation code from ChainIntegrate, paying
the gas with the service's own wallet: what LUKSO's relayer does for Universal Everything, with ChainIntegrate in
LUKSO's place. Node.js, one file (`creator.js`), ethers as its only dependency, behind nginx at `/api/`.

## What it does

`POST /api/create { invite, request, signature }`, from the extension:

1. **Limits**: requests per IP address per minute (`perIpPerMinute`), accounts per day in total (`maxPerDay`).
2. **The invitation code**: known, open, not expired. Codes are stored as SHA-256 hashes only.
3. **The request** (`shared/request.js`): cleaned and checked; the network must be the service's; at most
   `maxControllers` keys, at least one administrator.
4. **The signature**: `personal_sign` of `UPRequest.signingMessage(request)` by one of the request's
   administrator keys. An account is created only for keys their owner holds: never for a mistyped address.
5. **Creation**, one at a time: the image and the profile to ChainIntegrate's IPFS node (`shared/ipfs.js`, Kubo's `/api/v0/add`, pinned), served by its gateway `ipfs.chainintegrate.it`; the LSP23 call
   of `shared/deploy.js` with a random salt, sent by the gas wallet; refused while the wallet would fall under
   `minBalance`; the account read back (owner, Key Manager, keys, permissions, profile) once confirmed.
6. **The code** becomes `used`, with the account's address. If something fails after the transaction was sent,
   the code stays in `review` with the transaction: the operator looks at it (`invites`).

The service's wallet and ChainIntegrate have **no key and no permission** on the accounts: they belong to the
client's keys only.

`POST /api/lookup { address }`: the account this service created with that key among its keys (the extension
asks after restoring a backup on a new computer). Public data on the network anyway; at most 10 per minute.

`POST /api/relay/nonce { account, signer }` and `POST /api/relay { account, nonce, validity, payload, signature }`:
an operation on an account this service created, signed by one of its keys (LSP25 `executeRelayCall`,
`shared/relay.js`), sent and paid by the service. Allowed today: the profile (an IPFS VerifiableURI) and the
signer's own name; the projects' catalog comes next (`docs/integration.md`). Checks: the account is one the
service created; the request is valid for at most an hour; what it does is allowed (`UPRelay.check`); a
simulation, so whatever the Key Manager or the target refuses (a stranger's key, a device key without
EXECUTE_RELAY_CALL, a used nonce) costs nothing; `maxRelayPerDay` for the whole service (200), with an alert e-mail
when reached; `relayPerIpPerMinute` (20). Each operation sent is logged in `relay.jsonl` (account, signer,
operation, transaction, outcome).

## Commands

```bash
node creator.js invite --note "Rossi Srl"   # a new code, printed once: give it to the client
node creator.js invite --days 7             # one that expires sooner (default: inviteDays, 30)
node creator.js invites                     # id, state, dates, account, note
node creator.js revoke <code or id>         # an open code that may no longer be used
node creator.js status                      # gas wallet, balance, accounts today
node creator.js withdraw 0x… [amount]       # the gas wallet's LYX to an address of yours (all, minus the fee)
```

The gas wallet's key stays on the server (`gasKeyFile`): the service is the only one that uses it, and
`withdraw` takes the LYX back without it leaving the server. Never use that address for anything else.

With `CREATOR_CONFIG=/etc/up-onboarding/config.json` (the service's) and as the service's user, so the files keep
their owner: `sudo -u up-onboarding env CREATOR_CONFIG=/etc/up-onboarding/config.json node creator.js invite`.

## Alerts

`alert.js`, by e-mail through the same mailbox as Cross_Chain's relayer monitor (`smtp.env.example`):

- `failed <unit>`: systemd gave up restarting the service (5 restarts in 10 minutes; `OnFailure=` starts
  `up-onboarding-alert@.service`);
- `check`, every 10 minutes (`up-onboarding-creator-check.timer`): the service answers at `/api/health`, the gas
  wallet holds more than `minBalance` + 0.1, no code is in `review` (or `creating` for more than 15 minutes).
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
| `dataDir` | the codes (`invites.json`) and the log of created accounts (`created.jsonl`) |
| `maxPerDay`, `perIpPerMinute`, `maxControllers`, `inviteDays` | 20, 1, 5, 30 |
| `minBalance` | the gas wallet's floor, in LYX (0.05) |
| `maxRelayPerDay`, `relayPerIpPerMinute` | the relay's daily cap for the whole service and its per-address limit (200, 20) |
| `confirmSeconds` | how long to wait for the transaction (180) |
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
