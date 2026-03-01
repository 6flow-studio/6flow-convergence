import type {
  AbiFunction,
  AbiParameter as SharedAbiParameter,
  EvmArg,
  EvmReadNode,
  EvmWriteNode,
  GlobalConfig,
  Workflow,
} from "@6flow/shared/model/node";
import { SUPPORTED_CHAINS } from "@6flow/shared/supportedChain";
import {
  createPublicClient,
  encodeAbiParameters,
  http,
  stringToHex,
  zeroAddress,
  type Abi,
  type AbiParameter,
  type Address,
  type Hex,
} from "viem";
import { resolveTemplateValue } from "./resolve";
import { NodeExecutionError } from "./errors";

interface EvmExecutionResult {
  raw: unknown;
  normalized: unknown;
  warnings: string[];
}

export async function executeEvmReadNode(
  node: EvmReadNode,
  workflow: Workflow,
): Promise<EvmExecutionResult> {
  const config = node.data.config;
  if (!config.contractAddress.trim()) {
    throw new NodeExecutionError(
      "invalid_evm_read_config",
      "EVM read contract address is required.",
    );
  }
  if (!config.functionName.trim()) {
    throw new NodeExecutionError(
      "invalid_evm_read_config",
      "EVM read function name is required.",
    );
  }
  if (config.args.length !== config.abi.inputs.length) {
    throw new NodeExecutionError(
      "invalid_evm_read_config",
      "EVM read arguments must match the ABI input count for execution preview.",
    );
  }

  const { client, rpcUrl } = createEvmClient(config.chainSelectorName, workflow.globalConfig);
  const abiItem = toViemAbiFunction(config.abi);
  const args = config.args.map((arg, index) =>
    resolveEvmArgValue(arg, workflow, config.abi.inputs[index]),
  );

  const result = await client.readContract({
    address: config.contractAddress as Address,
    abi: [abiItem] as Abi,
    functionName: config.functionName,
    args,
    ...(config.fromAddress ? { account: config.fromAddress as Address } : {}),
    ...resolveBlockReference(config.blockNumber),
  });

  const normalized = normalizeReadResult(config.abi.outputs, result);
  return {
    raw: {
      rpcUrl,
      contractAddress: config.contractAddress,
      functionName: config.functionName,
      args,
      result,
    },
    normalized,
    warnings: [],
  };
}

export async function executeEvmWriteNode(
  node: EvmWriteNode,
  workflow: Workflow,
): Promise<EvmExecutionResult> {
  const config = node.data.config;
  if (!config.receiverAddress.trim()) {
    throw new NodeExecutionError(
      "invalid_evm_write_config",
      "EVM write receiver address is required.",
    );
  }
  if (config.abiParams.length === 0) {
    throw new NodeExecutionError(
      "invalid_evm_write_config",
      "EVM write preview requires at least one ABI parameter.",
    );
  }
  if (config.dataMapping.length !== config.abiParams.length) {
    throw new NodeExecutionError(
      "invalid_evm_write_config",
      "EVM write data mapping must match the ABI parameter count for execution preview.",
    );
  }

  const { client, rpcUrl } = createEvmClient(config.chainSelectorName, workflow.globalConfig);
  const resolvedArgs = config.dataMapping.map((arg, index) =>
    resolveEvmArgValue(arg, workflow, config.abiParams[index]),
  );
  const encodedData = encodeAbiParameters(
    toViemAbiParameters(config.abiParams),
    resolvedArgs,
  );

  const warnings = [
    "EVM write preview prepares calldata and estimates gas; it does not broadcast a transaction.",
  ];

  const normalized: Record<string, unknown> = {
    chainSelectorName: config.chainSelectorName,
    receiverAddress: config.receiverAddress,
    encodedData,
    gasLimit: config.gasLimit,
    valueWei: config.value ?? "0",
    simulationStatus: "prepared",
  };

  const raw: Record<string, unknown> = {
    rpcUrl,
    receiverAddress: config.receiverAddress,
    resolvedArgs,
    encodedData,
  };

  try {
    const estimatedGas = await client.estimateGas({
      account: zeroAddress,
      to: config.receiverAddress as Address,
      data: encodedData,
      ...(config.value ? { value: BigInt(config.value) } : {}),
    });
    normalized.estimatedGas = estimatedGas.toString();
    normalized.simulationStatus = "estimated";
    raw.estimatedGas = estimatedGas;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    normalized.simulationStatus = "estimateFailed";
    raw.estimateGasError = message;
    warnings.push(`Gas estimation failed: ${message}`);
  }

  try {
    raw.chainId = await client.getChainId();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Could not read chain ID from RPC: ${message}`);
  }

  return {
    raw,
    normalized,
    warnings,
  };
}

function createEvmClient(chainSelectorName: string, globalConfig: GlobalConfig) {
  const rpcUrl = resolveRpcUrl(chainSelectorName, globalConfig);
  return {
    rpcUrl,
    client: createPublicClient({
      transport: http(rpcUrl),
    }),
  };
}

function resolveRpcUrl(chainSelectorName: string, globalConfig: GlobalConfig): string {
  const configured = globalConfig.rpcs.find(
    (rpc) => rpc.chainName === chainSelectorName,
  );
  if (configured?.url) {
    return configured.url;
  }

  const supported = SUPPORTED_CHAINS.find(
    (chain) => chain.chainSelectorName === chainSelectorName,
  );
  if (supported?.defaultRPCUrl) {
    return supported.defaultRPCUrl;
  }

  throw new NodeExecutionError(
    "rpc_not_configured",
    `No RPC URL is configured for chain '${chainSelectorName}'.`,
  );
}

function resolveEvmArgValue(
  arg: EvmArg,
  workflow: Workflow,
  abiParam?: SharedAbiParameter,
): unknown {
  const resolved =
    arg.type === "reference" || arg.value.includes("{{")
      ? resolveTemplateValue(arg.value, workflow)
      : arg.value;
  return coerceAbiValue(abiParam?.type ?? arg.abiType, resolved, abiParam?.components);
}

function coerceAbiValue(
  abiType: string,
  value: unknown,
  components?: SharedAbiParameter[],
): unknown {
  if (abiType.endsWith("[]")) {
    const baseType = abiType.slice(0, -2);
    const arrayValue = normalizeCollectionValue(value);
    return arrayValue.map((item) => coerceAbiValue(baseType, item, components));
  }

  if (abiType === "tuple") {
    const tupleValue = normalizeTupleValue(value);
    if (Array.isArray(tupleValue)) {
      return tupleValue.map((item, index) =>
        coerceAbiValue(
          components?.[index]?.type ?? "string",
          item,
          components?.[index]?.components,
        ),
      );
    }

    if (!components) {
      return tupleValue;
    }

    return components.reduce<Record<string, unknown>>((acc, component) => {
      acc[component.name] = coerceAbiValue(
        component.type,
        tupleValue[component.name],
        component.components,
      );
      return acc;
    }, {});
  }

  if (abiType.startsWith("uint") || abiType.startsWith("int")) {
    if (typeof value === "bigint") {
      return value;
    }
    if (typeof value === "number") {
      return BigInt(Math.trunc(value));
    }
    return BigInt(String(value).trim());
  }

  if (abiType === "bool") {
    if (typeof value === "boolean") {
      return value;
    }
    return String(value).trim().toLowerCase() === "true";
  }

  if (abiType === "address") {
    return String(value) as Address;
  }

  if (abiType.startsWith("bytes")) {
    if (typeof value === "string" && value.startsWith("0x")) {
      return value as Hex;
    }
    return stringToHex(String(value));
  }

  if (abiType === "string") {
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  return value;
}

function normalizeCollectionValue(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  }
  throw new NodeExecutionError(
    "invalid_evm_arg",
    "Array ABI values must resolve to a JSON array or array value.",
  );
}

function normalizeTupleValue(value: unknown): Record<string, unknown> | unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  }
  throw new NodeExecutionError(
    "invalid_evm_arg",
    "Tuple ABI values must resolve to a JSON object, JSON array, object, or array value.",
  );
}

function normalizeReadResult(
  outputs: AbiFunction["outputs"],
  result: unknown,
): Record<string, unknown> {
  if (outputs.length === 0) {
    return { value: result };
  }

  if (outputs.length === 1) {
    return {
      [outputs[0]?.name || "value"]: result,
    };
  }

  if (Array.isArray(result)) {
    return outputs.reduce<Record<string, unknown>>((acc, output, index) => {
      acc[output.name || `output${index}`] = result[index];
      return acc;
    }, {});
  }

  if (result && typeof result === "object") {
    return outputs.reduce<Record<string, unknown>>((acc, output, index) => {
      const key = output.name || `output${index}`;
      acc[key] = (result as Record<string, unknown>)[key];
      return acc;
    }, {});
  }

  return outputs.reduce<Record<string, unknown>>((acc, output, index) => {
    acc[output.name || `output${index}`] = index === 0 ? result : undefined;
    return acc;
  }, {});
}

function resolveBlockReference(blockNumber: EvmReadNode["data"]["config"]["blockNumber"]) {
  if (!blockNumber || blockNumber === "latest" || blockNumber === "finalized") {
    return blockNumber
      ? { blockTag: blockNumber as "latest" | "finalized" }
      : {};
  }
  return { blockNumber: BigInt(blockNumber) };
}

function toViemAbiFunction(abiFunction: AbiFunction): AbiFunction {
  return {
    ...abiFunction,
    inputs: abiFunction.inputs.map((input) => toSharedAbiParameter(input)),
    outputs: abiFunction.outputs.map((output) => toSharedAbiParameter(output)),
  };
}

function toSharedAbiParameter(parameter: SharedAbiParameter): SharedAbiParameter {
  return {
    ...parameter,
    components: parameter.components?.map((component) =>
      toSharedAbiParameter(component),
    ),
  };
}

function toViemAbiParameters(parameters: SharedAbiParameter[]): readonly AbiParameter[] {
  return parameters.map((parameter) => ({
    name: parameter.name,
    type: parameter.type,
    ...(parameter.components
      ? { components: toViemAbiParameters(parameter.components) }
      : {}),
  }));
}
