// The creation service. The network where accounts are created is the service's own (asked at /api/health), so
// a test service on LUKSO Testnet needs no other extension.
//   service: the address the extension sends "Create my account" to (tools/creator, behind nginx);
//   profileBase: where "See your public profile" opens a created account (its address is appended).
const CONFIG = {
  service: "https://account.chainintegrate.it/api/create",
  lookup: "https://account.chainintegrate.it/api/lookup",
  health: "https://account.chainintegrate.it/api/health",
  profileBase: "https://universaleverything.io/",
};
