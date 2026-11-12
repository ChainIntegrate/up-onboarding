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

## Configuration

`config.example.json`; paths relative to the configuration file.

| Key | |
|---|---|
| `network`, `rpc`, `chainId` | `lukso` (42) or `lukso-testnet` (4201) and an RPC of that network |
| `gasKeyFile` | the gas wallet's private key, one line, mode 600: a wallet used only for this, with little LYX |
| `ipfsApi` | the IPFS node's API: `http://127.0.0.1:5001` when the node runs on this machine, else its address (the node must allow this server) |
| `ipfsAuthFile` | optional: an `Authorization` header value, one line, mode 600, when the node's API is behind a proxy that asks for one |
| `dataDir` | the codes (`invites.json`) and the log of created accounts (`created.jsonl`) |
| `maxPerDay`, `perIpPerMinute`, `maxControllers`, `inviteDays` | 20, 1, 5, 30 |
| `minBalance` | the gas wallet's floor, in LYX (0.05) |
| `confirmSeconds` | how long to wait for the transaction (180) |

A creation costs about 0.01 LYX with the profile on IPFS. Installation: [../../DEPLOY.md](../../DEPLOY.md).
Tests: `npm run test:creator` (a local chain with LUKSO's contracts, the IPFS API answered locally).
