import type { GlobalConfig } from "@6flow/shared/model/node";

export const WORKFLOW_VERSION = "1.0.0";

export const DEFAULT_WORKFLOW_GLOBAL_CONFIG: GlobalConfig = {
  isTestnet: true,
  defaultChainSelector: "ethereum-testnet-sepolia",
  secrets: [],
};

export function cloneGlobalConfig(config: GlobalConfig): GlobalConfig {
  return {
    isTestnet: config.isTestnet,
    defaultChainSelector: config.defaultChainSelector,
    secrets: config.secrets.map((secret) => ({
      name: secret.name,
      envVariable: secret.envVariable,
    })),
  };
}
