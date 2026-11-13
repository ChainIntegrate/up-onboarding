// The account service. The network where accounts are created is the service's own (asked at /api/health), so
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
  // The account's current profile (name, description, picture) and this computer's name on it, after a restore.
  profileRead: "https://account.chainintegrate.it/api/profile/read",
  // Where the profile's picture is shown from (the IPFS gateway Universal Everything uses).
  gateway: "https://api.universalprofile.cloud/ipfs/",
  // The SHA-256 of each released version's files, served by ChainIntegrate's site (web/extension/<v>/SHA256SUMS):
  // the extension checks its own files against them before unlocking the key.
  sums: "https://account.chainintegrate.it/extension/",
  profileBase: "https://universaleverything.io/",
  // The networks an account may be on: the chain id the projects' pages see, and where reading the network goes.
  // On LUKSO, ChainIntegrate's own node through the account service (/api/rpc: the node's access key stays on the
  // server), LUKSO's public node when it does not answer.
  networks: {
    lukso: { chainId: 42, rpc: "https://account.chainintegrate.it/api/rpc", fallback: "https://rpc.mainnet.lukso.network" },
    "lukso-testnet": { chainId: 4201, rpc: "https://rpc.testnet.lukso.network" },
  },
};
