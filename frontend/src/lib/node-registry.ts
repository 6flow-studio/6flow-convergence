/**
 * SYNC NOTE: Keep this registry in sync with node types/configs in
 * `shared/model/node.ts` (see the checklist comment there).
 */
import type { NodeType, NodeCategory } from "@6flow/shared/model/node";

export interface NodeRegistryEntry {
  type: NodeType;
  label: string;
  category: NodeCategory;
  color: string;
  icon: string;
  inputs: { name: string }[];
  outputs: { name: string }[];
  defaultConfig: Record<string, unknown>;
}

export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  trigger: "#ef4444",
  action: "#3b82f6",
  transform: "#a855f7",
  controlFlow: "#f97316",
  ai: "#22c55e",
  output: "#6b7280",
  tokenization: "#eab308",
  regulation: "#14b8a6",
};

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: "Triggers",
  action: "Actions",
  transform: "Transforms",
  controlFlow: "Control Flow",
  ai: "AI",
  output: "Output",
  tokenization: "Tokenization",
  regulation: "Regulation",
};

export const NODE_REGISTRY: NodeRegistryEntry[] = [
  // Triggers
  {
    type: "cronTrigger",
    label: "Cron Trigger",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Clock",
    inputs: [],
    outputs: [{ name: "output" }],
    defaultConfig: { schedule: "0 */10 * * * *", timezone: "UTC" },
  },
  {
    type: "httpTrigger",
    label: "HTTP Trigger",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Webhook",
    inputs: [],
    outputs: [{ name: "output" }],
    defaultConfig: {
      httpMethod: "POST",
      authentication: { type: "none" },
      responseMode: "immediate",
    },
  },
  {
    type: "evmLogTrigger",
    label: "EVM Log Trigger",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Radio",
    inputs: [],
    outputs: [{ name: "output" }],
    defaultConfig: {
      chainSelectorName: "ethereum-testnet-sepolia",
      contractAddresses: [],
      eventSignature: "",
      eventAbi: { type: "event", name: "", inputs: [] },
    },
  },

  // Actions
  {
    type: "httpRequest",
    label: "HTTP Request",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Globe",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: { method: "GET", url: "", responseFormat: "json" },
  },
  {
    type: "evmRead",
    label: "EVM Read",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "BookOpen",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: {
      chainSelectorName: "ethereum-testnet-sepolia",
      contractAddress: "",
      functionName: "",
      args: [],
    },
  },
  {
    type: "evmWrite",
    label: "EVM Write",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Pencil",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: {
      chainSelectorName: "ethereum-testnet-sepolia",
      receiverAddress: "",
      gasLimit: "500000",
      abiParams: [],
      dataMapping: [],
    },
  },
  {
    type: "getSecret",
    label: "Get Secret",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "KeyRound",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: { secretName: "" },
  },

  // Transforms
  {
    type: "codeNode",
    label: "Code",
    category: "transform",
    color: CATEGORY_COLORS.transform,
    icon: "Code",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: {
      code: "// Write your TypeScript code here\nreturn input;",
      language: "typescript",
      executionMode: "runOnceForAll",
      inputVariables: [],
    },
  },
  {
    type: "jsonParse",
    label: "JSON Parse",
    category: "transform",
    color: CATEGORY_COLORS.transform,
    icon: "Braces",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: { strict: true },
  },
  {
    type: "abiEncode",
    label: "ABI Encode",
    category: "transform",
    color: CATEGORY_COLORS.transform,
    icon: "FileCode",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: { abiParams: [], dataMapping: [] },
  },
  {
    type: "abiDecode",
    label: "ABI Decode",
    category: "transform",
    color: CATEGORY_COLORS.transform,
    icon: "FileOutput",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: { abiParams: [], outputNames: [] },
  },
  {
    type: "merge",
    label: "Merge",
    category: "transform",
    color: CATEGORY_COLORS.transform,
    icon: "Merge",
    inputs: [{ name: "input1" }, { name: "input2" }],
    outputs: [{ name: "output" }],
    defaultConfig: { strategy: { mode: "append" }, numberOfInputs: 2 },
  },

  // Control Flow
  {
    type: "if",
    label: "If",
    category: "controlFlow",
    color: CATEGORY_COLORS.controlFlow,
    icon: "GitBranch",
    inputs: [{ name: "input" }],
    outputs: [{ name: "true" }, { name: "false" }],
    defaultConfig: {
      conditions: [{ field: "", operator: "equals", value: "" }],
      combineWith: "and",
    },
  },
  {
    type: "filter",
    label: "Filter",
    category: "controlFlow",
    color: CATEGORY_COLORS.controlFlow,
    icon: "Filter",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: {
      conditions: [{ field: "", operator: "equals", value: "" }],
      combineWith: "and",
    },
  },

  // AI
  {
    type: "ai",
    label: "AI",
    category: "ai",
    color: CATEGORY_COLORS.ai,
    icon: "Brain",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: {
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4",
      apiKeySecret: "",
      systemPrompt: "",
      userPrompt: "",
      temperature: 0.7,
      responseFormat: "text",
    },
  },

  // Output
  {
    type: "return",
    label: "Return",
    category: "output",
    color: CATEGORY_COLORS.output,
    icon: "CornerDownLeft",
    inputs: [{ name: "input" }],
    outputs: [],
    defaultConfig: { returnExpression: "result" },
  },
  {
    type: "log",
    label: "Log",
    category: "output",
    color: CATEGORY_COLORS.output,
    icon: "Terminal",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: { level: "info", messageTemplate: "" },
  },
  {
    type: "error",
    label: "Error",
    category: "output",
    color: CATEGORY_COLORS.output,
    icon: "AlertTriangle",
    inputs: [{ name: "input" }],
    outputs: [],
    defaultConfig: { errorMessage: "" },
  },

  // Tokenization
  {
    type: "mintToken",
    label: "Mint Token",
    category: "tokenization",
    color: CATEGORY_COLORS.tokenization,
    icon: "Coins",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: {
      chainSelectorName: "ethereum-testnet-sepolia",
      tokenContractAddress: "",
      gasLimit: "500000",
    },
  },
  {
    type: "burnToken",
    label: "Burn Token",
    category: "tokenization",
    color: CATEGORY_COLORS.tokenization,
    icon: "Flame",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: {
      chainSelectorName: "ethereum-testnet-sepolia",
      tokenContractAddress: "",
      gasLimit: "500000",
    },
  },
  {
    type: "transferToken",
    label: "Transfer Token",
    category: "tokenization",
    color: CATEGORY_COLORS.tokenization,
    icon: "ArrowRightLeft",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: {
      chainSelectorName: "ethereum-testnet-sepolia",
      tokenContractAddress: "",
      gasLimit: "500000",
    },
  },

  // Regulation
  {
    type: "checkKyc",
    label: "Check KYC",
    category: "regulation",
    color: CATEGORY_COLORS.regulation,
    icon: "ShieldCheck",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: { providerUrl: "", apiKeySecretName: "", walletAddressSource: "" },
  },
  {
    type: "checkBalance",
    label: "Check Balance",
    category: "regulation",
    color: CATEGORY_COLORS.regulation,
    icon: "Wallet",
    inputs: [{ name: "input" }],
    outputs: [{ name: "output" }],
    defaultConfig: {
      chainSelectorName: "ethereum-testnet-sepolia",
      tokenContractAddress: "",
      addressSource: "",
    },
  },
];

export function getNodeEntry(type: NodeType): NodeRegistryEntry | undefined {
  return NODE_REGISTRY.find((n) => n.type === type);
}

export function getNodesByCategory(): Record<NodeCategory, NodeRegistryEntry[]> {
  const grouped = {} as Record<NodeCategory, NodeRegistryEntry[]>;
  for (const entry of NODE_REGISTRY) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(entry);
  }
  return grouped;
}
