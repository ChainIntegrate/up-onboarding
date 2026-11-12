// The creation service. The network where accounts are created is the service's own (asked at /api/health), so
// a test service on LUKSO Testnet needs no other extension.
//   service: the address the extension sends "Create my account" to (tools/creator, behind nginx);
//   profileBase: where "See your public profile" opens a created account (its address is appended).
const CONFIG = {
  service: "https://account.chainintegrate.it/api/create",
  lookup: "https://account.chainintegrate.it/api/lookup",
  health: "https://account.chainintegrate.it/api/health",
  // Changes to the account, gas paid by the service (LSP25): the nonce, the operation, a new profile on IPFS.
  relayNonce: "https://account.chainintegrate.it/api/relay/nonce",
  relay: "https://account.chainintegrate.it/api/relay",
  profile: "https://account.chainintegrate.it/api/profile",
  // The SHA-256 of each released version's files, served by ChainIntegrate's site (web/extension/<v>/SHA256SUMS):
  // the extension checks its own files against them before unlocking the key.
  sums: "https://account.chainintegrate.it/extension/",
  profileBase: "https://universaleverything.io/",
  // The networks an account may be on: the chain id the projects' pages see, LUKSO's public node for what they read.
  networks: {
    lukso: { chainId: 42, rpc: "https://rpc.mainnet.lukso.network" },
    "lukso-testnet": { chainId: 4201, rpc: "https://rpc.testnet.lukso.network" },
  },
};
