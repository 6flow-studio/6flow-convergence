import type {
  GlobalConfig,
  RpcEntry,
  SecretReference,
} from "@6flow/shared/model/node";

function isSecretReference(value: unknown): value is SecretReference {
  if (!value || typeof value !== "object") return false;

  const secret = value as Partial<SecretReference>;
  return typeof secret.name === "string" && typeof secret.envVariable === "string";
}

function isRpcEntry(value: unknown): value is RpcEntry {
  if (!value || typeof value !== "object") return false;

  const rpc = value as Partial<RpcEntry>;
  return typeof rpc.chainName === "string" && typeof rpc.url === "string";
}

export function createDefaultGlobalConfig(): GlobalConfig {
  return {
    isTestnet: true,
    secrets: [],
    rpcs: [],
  };
}

export function sanitizeGlobalConfig(value: unknown): GlobalConfig {
  const defaults = createDefaultGlobalConfig();
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const incoming = value as Partial<GlobalConfig> & {
    secrets?: unknown;
    rpcs?: unknown;
  };
  const secrets = Array.isArray(incoming.secrets)
    ? incoming.secrets
        .filter(isSecretReference)
        .map((secret) => ({
          name: secret.name,
          envVariable: secret.envVariable,
        }))
    : defaults.secrets;
  const rpcs = Array.isArray(incoming.rpcs)
    ? incoming.rpcs
        .filter(isRpcEntry)
        .map((rpc) => ({
          chainName: rpc.chainName,
          url: rpc.url,
        }))
    : defaults.rpcs;

  return {
    isTestnet: typeof incoming.isTestnet === "boolean" ? incoming.isTestnet : defaults.isTestnet,
    secrets,
    rpcs,
  };
}
