export interface SupportedChain {
  name: string;
  chainSelectorName: string;
  numericId: string;
  isTestnet: boolean;
  defaultRPCUrl: string;
}

export const SUPPORTED_CHAINS: SupportedChain[] = [
  {
    name: "Ethereum Mainnet",
    chainSelectorName: "ethereum-mainnet",
    numericId: "5009297550715157269",
    isTestnet: false,
    defaultRPCUrl: "https://eth.llamarpc.com",
  },
  {
    name: "Ethereum Sepolia",
    chainSelectorName: "ethereum-testnet-sepolia",
    numericId: "16015286601757825753",
    isTestnet: true,
    defaultRPCUrl: "https://rpc.sepolia.org",
  },
  {
    name: "Polygon Mainnet",
    chainSelectorName: "polygon-mainnet",
    numericId: "4051577828743386545",
    isTestnet: false,
    defaultRPCUrl: "https://rpc.ankr.com/polygon",
  },
  {
    name: "Polygon Amoy",
    chainSelectorName: "polygon-testnet-amoy",
    numericId: "16281711391670634445",
    isTestnet: true,
    defaultRPCUrl: "https://rpc-amoy.polygon.technology",
  },
  {
    name: "Arbitrum One",
    chainSelectorName: "ethereum-mainnet-arbitrum-1",
    numericId: "4949039107694359620",
    isTestnet: false,
    defaultRPCUrl: "https://arb1.arbitrum.io/rpc",
  },
  {
    name: "Arbitrum Sepolia",
    chainSelectorName: "ethereum-testnet-sepolia-arbitrum-1",
    numericId: "3478487238524512106",
    isTestnet: true,
    defaultRPCUrl: "https://sepolia-rollup.arbitrum.io/rpc",
  },
  {
    name: "OP Mainnet",
    chainSelectorName: "ethereum-mainnet-optimism-1",
    numericId: "3734403246176062136",
    isTestnet: false,
    defaultRPCUrl: "https://mainnet.optimism.io",
  },
  {
    name: "OP Sepolia",
    chainSelectorName: "ethereum-testnet-sepolia-optimism-1",
    numericId: "5224473277236331295",
    isTestnet: true,
    defaultRPCUrl: "https://sepolia.optimism.io",
  },
  {
    name: "Avalanche Mainnet",
    chainSelectorName: "avalanche-mainnet",
    numericId: "6433500567565415381",
    isTestnet: false,
    defaultRPCUrl: "https://api.avax.network/ext/bc/C/rpc",
  },
  {
    name: "Avalanche Fuji",
    chainSelectorName: "avalanche-testnet-fuji",
    numericId: "14767482510784806043",
    isTestnet: true,
    defaultRPCUrl: "https://api.avax-test.network/ext/bc/C/rpc",
  },
  {
    name: "Base Mainnet",
    chainSelectorName: "ethereum-mainnet-base-1",
    numericId: "15971525489660198786",
    isTestnet: false,
    defaultRPCUrl: "https://base.llamarpc.com",
  },
  {
    name: "Base Sepolia",
    chainSelectorName: "ethereum-testnet-sepolia-base-1",
    numericId: "10344971235874465080",
    isTestnet: true,
    defaultRPCUrl: "https://sepolia.base.org",
  },
  {
    name: "BNB Chain Mainnet",
    chainSelectorName: "binance_smart_chain-mainnet",
    numericId: "11344663589394136015",
    isTestnet: false,
    defaultRPCUrl: "https://binance.llamarpc.com",
  },
  {
    name: "BNB Chain Testnet",
    chainSelectorName: "binance_smart_chain-testnet",
    numericId: "5142893604156789321",
    isTestnet: true,
    defaultRPCUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
  },
];

export type ChainSelectorName = SupportedChain["chainSelectorName"];
