// A local chain with LUKSO Testnet's chainId (test/e2e.js) or, with CHAIN_ID=42, LUKSO's (test/creator.js: the
// projects' catalog is on LUKSO).
module.exports = { solidity: "0.8.20", networks: { hardhat: { chainId: Number(process.env.CHAIN_ID || 4201), blockGasLimit: 42000000 } } };
