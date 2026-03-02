export interface SupportedChain {
  name: string;
  chainSelectorName: string;
  numericId: string;
  chainId: number;
  isTestnet: boolean;
  defaultRPCUrl: string;
  internalRPCUrl: string;
}

export const SUPPORTED_CHAINS: SupportedChain[] = [
  {
    name: "Ethereum Mainnet",
    chainSelectorName: "ethereum-mainnet",
    numericId: "5009297550715157269",
    chainId: 1,
    isTestnet: false,
    defaultRPCUrl: "https://eth.llamarpc.com",
    internalRPCUrl: "https://eth-mainnet.g.alchemy.com/v2/",
  },
  {
    name: "Ethereum Sepolia",
    chainSelectorName: "ethereum-testnet-sepolia",
    numericId: "16015286601757825753",
    chainId: 11155111,
    isTestnet: true,
    defaultRPCUrl: "https://rpc.sepolia.org",
    internalRPCUrl: "https://eth-sepolia.g.alchemy.com/v2/",
  },
  {
    name: "Polygon Mainnet",
    chainSelectorName: "polygon-mainnet",
    numericId: "4051577828743386545",
    chainId: 137,
    isTestnet: false,
    defaultRPCUrl: "https://rpc.ankr.com/polygon",
    internalRPCUrl: "https://polygon-mainnet.g.alchemy.com/v2/",
  },
  {
    name: "Polygon Amoy",
    chainSelectorName: "polygon-testnet-amoy",
    numericId: "16281711391670634445",
    chainId: 80002,
    isTestnet: true,
    defaultRPCUrl: "https://rpc-amoy.polygon.technology",
    internalRPCUrl: "https://polygon-amoy.g.alchemy.com/v2/",
  },
  {
    name: "Arbitrum One",
    chainSelectorName: "ethereum-mainnet-arbitrum-1",
    numericId: "4949039107694359620",
    chainId: 42161,
    isTestnet: false,
    defaultRPCUrl: "https://arb1.arbitrum.io/rpc",
    internalRPCUrl: "https://arb-mainnet.g.alchemy.com/v2/",
  },
  {
    name: "Arbitrum Sepolia",
    chainSelectorName: "ethereum-testnet-sepolia-arbitrum-1",
    numericId: "3478487238524512106",
    chainId: 421614,
    isTestnet: true,
    defaultRPCUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    internalRPCUrl: "https://arb-sepolia.g.alchemy.com/v2/",
  },
  {
    name: "OP Mainnet",
    chainSelectorName: "ethereum-mainnet-optimism-1",
    numericId: "3734403246176062136",
    chainId: 10,
    isTestnet: false,
    defaultRPCUrl: "https://mainnet.optimism.io",
    internalRPCUrl: "https://opt-mainnet.g.alchemy.com/v2/"
  },
  {
    name: "OP Sepolia",
    chainSelectorName: "ethereum-testnet-sepolia-optimism-1",
    numericId: "5224473277236331295",
    chainId: 11155420,
    isTestnet: true,
    defaultRPCUrl: "https://sepolia.optimism.io",
    internalRPCUrl: "https://opt-sepolia.g.alchemy.com/v2/"
  },
  {
    name: "Avalanche Mainnet",
    chainSelectorName: "avalanche-mainnet",
    numericId: "6433500567565415381",
    chainId: 43114,
    isTestnet: false,
    defaultRPCUrl: "https://api.avax.network/ext/bc/C/rpc",
    internalRPCUrl: "https://avax-mainnet.g.alchemy.com/v2/"
  },
  {
    name: "Avalanche Fuji",
    chainSelectorName: "avalanche-testnet-fuji",
    numericId: "14767482510784806043",
    chainId: 43113,
    isTestnet: true,
    defaultRPCUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    internalRPCUrl: "https://avax-fuji.g.alchemy.com/v2/"
  },
  {
    name: "Base Mainnet",
    chainSelectorName: "ethereum-mainnet-base-1",
    numericId: "15971525489660198786",
    chainId: 8453,
    isTestnet: false,
    defaultRPCUrl: "https://base.llamarpc.com",
    internalRPCUrl: "https://base-mainnet.g.alchemy.com/v2/"
  },
  {
    name: "Base Sepolia",
    chainSelectorName: "ethereum-testnet-sepolia-base-1",
    numericId: "10344971235874465080",
    chainId: 84532,
    isTestnet: true,
    defaultRPCUrl: "https://sepolia.base.org",
    internalRPCUrl: "https://base-sepolia.g.alchemy.com/v2/"
  },
  {
    name: "BNB Chain Mainnet",
    chainSelectorName: "binance_smart_chain-mainnet",
    numericId: "11344663589394136015",
    chainId: 56,
    isTestnet: false,
    defaultRPCUrl: "https://binance.llamarpc.com",
    internalRPCUrl: "https://bnb-mainnet.g.alchemy.com/v2/"
  },
  {
    name: "BNB Chain Testnet",
    chainSelectorName: "binance_smart_chain-testnet",
    numericId: "5142893604156789321",
    chainId: 97,
    isTestnet: true,
    defaultRPCUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    internalRPCUrl: "https://bnb-testnet.g.alchemy.com/v2/"
  },
];

export type ChainSelectorName = SupportedChain["chainSelectorName"];
