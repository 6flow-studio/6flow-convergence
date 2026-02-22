import type { GlobalConfig } from "@6flow/shared/model/node";

export const WORKFLOW_VERSION = "1.0.0";

export const DEFAULT_WORKFLOW_GLOBAL_CONFIG: GlobalConfig = {
  isTestnet: true,
  secrets: [],
  rpcs: [],
};

export function cloneGlobalConfig(config: GlobalConfig): GlobalConfig {
  return {
    isTestnet: config.isTestnet,
    secrets: config.secrets.map((secret) => ({
      name: secret.name,
      envVariable: secret.envVariable,
    })),
    rpcs: config.rpcs.map((rpc) => ({
      chainName: rpc.chainName,
      url: rpc.url,
    })),
  };
}
