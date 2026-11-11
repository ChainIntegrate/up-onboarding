// The networks the pages work on: LUKSO and its testnet (same values as Cross_Chain's chains.js).
const LUKSO_CHAIN = { key: "lukso", name: "LUKSO", chainId: 42, rpc: "https://rpc.mainnet.lukso.network", explorerBase: "https://explorer.execution.mainnet.lukso.network", currency: "LYX" };
const LUKSO_TESTNET_CHAIN = { key: "lukso-testnet", name: "LUKSO Testnet", chainId: 4201, rpc: "https://rpc.testnet.lukso.network", explorerBase: "https://explorer.execution.testnet.lukso.network", currency: "LYXt" };

// The parameters of wallet_addEthereumChain, for a wallet that does not know the network yet.
function addChainParams(net, chainId = net.chainId) {
  const p = { chainId: "0x" + Number(chainId).toString(16), chainName: net.name, rpcUrls: [net.rpc],
    nativeCurrency: { name: net.currency, symbol: net.currency, decimals: 18 } };
  if (net.explorerBase) p.blockExplorerUrls = [net.explorerBase];
  return p;
}
