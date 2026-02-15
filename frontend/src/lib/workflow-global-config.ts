import type { GlobalConfig, SecretReference } from "@6flow/shared/model/node";

const DEFAULT_CHAIN_SELECTOR = "ethereum-testnet-sepolia";

function isSecretReference(value: unknown): value is SecretReference {
  if (!value || typeof value !== "object") return false;

  const secret = value as Partial<SecretReference>;
  return typeof secret.name === "string" && typeof secret.envVariable === "string";
}

export function createDefaultGlobalConfig(): GlobalConfig {
  return {
    isTestnet: true,
    defaultChainSelector: DEFAULT_CHAIN_SELECTOR,
    secrets: [],
    privateKey: "",
  };
}

export function sanitizeGlobalConfig(value: unknown): GlobalConfig {
  const defaults = createDefaultGlobalConfig();
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const incoming = value as Partial<GlobalConfig> & { secrets?: unknown };
  const secrets = Array.isArray(incoming.secrets)
    ? incoming.secrets
        .filter(isSecretReference)
        .map((secret) => ({
          name: secret.name,
          envVariable: secret.envVariable,
        }))
    : defaults.secrets;

  return {
    isTestnet: typeof incoming.isTestnet === "boolean" ? incoming.isTestnet : defaults.isTestnet,
    defaultChainSelector:
      typeof incoming.defaultChainSelector === "string" && incoming.defaultChainSelector.trim().length > 0
        ? incoming.defaultChainSelector
        : defaults.defaultChainSelector,
    secrets,
    privateKey: typeof incoming.privateKey === "string" ? incoming.privateKey : defaults.privateKey,
  };
}
