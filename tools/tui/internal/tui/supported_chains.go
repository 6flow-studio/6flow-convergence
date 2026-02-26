package tui

type supportedChain struct {
	Name          string
	ChainName     string
	IsTestnet     bool
	DefaultRPCURL string
}

var supportedChains = []supportedChain{
	{Name: "Ethereum Mainnet", ChainName: "ethereum-mainnet", IsTestnet: false, DefaultRPCURL: "https://eth.llamarpc.com"},
	{Name: "Ethereum Sepolia", ChainName: "ethereum-testnet-sepolia", IsTestnet: true, DefaultRPCURL: "https://rpc.sepolia.org"},
	{Name: "Polygon Mainnet", ChainName: "polygon-mainnet", IsTestnet: false, DefaultRPCURL: "https://rpc.ankr.com/polygon"},
	{Name: "Polygon Amoy", ChainName: "polygon-testnet-amoy", IsTestnet: true, DefaultRPCURL: "https://rpc-amoy.polygon.technology"},
	{Name: "Arbitrum One", ChainName: "ethereum-mainnet-arbitrum-1", IsTestnet: false, DefaultRPCURL: "https://arb1.arbitrum.io/rpc"},
	{Name: "Arbitrum Sepolia", ChainName: "ethereum-testnet-sepolia-arbitrum-1", IsTestnet: true, DefaultRPCURL: "https://sepolia-rollup.arbitrum.io/rpc"},
	{Name: "OP Mainnet", ChainName: "ethereum-mainnet-optimism-1", IsTestnet: false, DefaultRPCURL: "https://mainnet.optimism.io"},
	{Name: "OP Sepolia", ChainName: "ethereum-testnet-sepolia-optimism-1", IsTestnet: true, DefaultRPCURL: "https://sepolia.optimism.io"},
	{Name: "Avalanche Mainnet", ChainName: "avalanche-mainnet", IsTestnet: false, DefaultRPCURL: "https://api.avax.network/ext/bc/C/rpc"},
	{Name: "Avalanche Fuji", ChainName: "avalanche-testnet-fuji", IsTestnet: true, DefaultRPCURL: "https://api.avax-test.network/ext/bc/C/rpc"},
	{Name: "Base Mainnet", ChainName: "ethereum-mainnet-base-1", IsTestnet: false, DefaultRPCURL: "https://base.llamarpc.com"},
	{Name: "Base Sepolia", ChainName: "ethereum-testnet-sepolia-base-1", IsTestnet: true, DefaultRPCURL: "https://sepolia.base.org"},
	{Name: "BNB Chain Mainnet", ChainName: "binance_smart_chain-mainnet", IsTestnet: false, DefaultRPCURL: "https://binance.llamarpc.com"},
	{Name: "BNB Chain Testnet", ChainName: "binance_smart_chain-testnet", IsTestnet: true, DefaultRPCURL: "https://data-seed-prebsc-1-s1.binance.org:8545"},
}

func supportedChainsForTarget(isTestnet bool) []supportedChain {
	out := make([]supportedChain, 0, len(supportedChains))
	for _, chain := range supportedChains {
		if chain.IsTestnet == isTestnet {
			out = append(out, chain)
		}
	}
	return out
}
