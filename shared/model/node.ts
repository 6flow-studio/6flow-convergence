/**
 * NOT FINALIZED
 *
 * 6Flow Studio - Node & Edge Schema Definitions
 *
 * These TypeScript interfaces define the data model for the visual workflow builder.
 * They serve as the contract between:
 *   - React Flow frontend (node rendering & editing)
 *   - NestJS backend (storage & validation)
 *   - Rust compiler (code generation to CRE TypeScript)
 */
/**
 * SYNC NOTE: If you change node types or node config shapes here, also review:
 * - frontend/src/lib/node-registry.ts
 * - frontend/src/components/editor/ConfigPanel.tsx
 * - frontend/src/components/editor/config-renderers/*
 * - frontend/src/lib/workflow-convert.ts
 * - compiler/src/parse/types.rs
 * - compiler/src/ir/types.rs
 * - compiler/src/validate/node_rules.rs
 * - compiler/src/lower/mod.rs
 * - compiler/src/lower/trigger.rs
 * - compiler/src/lower/builder.rs
 * - compiler/src/lower/expand.rs
 * - compiler/src/lower/extract.rs
 * - compiler/src/codegen/files.rs
 * - compiler/tests/helpers/mod.rs
 * - compiler/tests/parse_basic.rs and compiler/tests/fixtures/*
 */

import type { ChainSelectorName } from "../supportedChain";

// =============================================================================
// BASE TYPES
// =============================================================================

/** Position type from React Flow */
export interface Position {
  x: number;
  y: number;
}

/** Error handling behavior when a node fails */
export type OnErrorBehavior = "stop" | "continue" | "continueWithError";

/** Common settings shared by all nodes */
export interface NodeSettings {
  retryOnFail?: {
    enabled: boolean;
    maxTries: number; // 1-5, default 3
    waitBetweenTries: number; // ms, default 1000
  };
  onError?: OnErrorBehavior; // default 'stop'
  notes?: string; // User-facing documentation note
  executeOnce?: boolean; // Only process first item (for batch scenarios)
}

/** Generic base node - all nodes extend this */
export interface BaseNode<T extends NodeType, C> {
  id: string;
  type: T;
  position: Position;
  data: {
    label: string;
    config: C;
  };
  settings?: NodeSettings;
}

/** Edge connecting two nodes */
export interface WorkflowEdge {
  id: string;
  source: string; // Source node ID
  target: string; // Target node ID
  sourceHandle?: string; // Output port name (for multi-output nodes like IfElse)
  targetHandle?: string; // Input port name (for multi-input nodes like Merge)
}

/** A user-defined RPC endpoint for a specific blockchain */
export interface RpcEntry {
  chainName: string; // e.g. "ethereum-testnet-sepolia"
  url: string; // e.g. "https://my-rpc.example.com"
}

/** Global workflow configuration */
export interface GlobalConfig {
  isTestnet: boolean;
  secrets: SecretReference[];
  rpcs: RpcEntry[];
}

/** Reference to a secret in secrets.yaml */
export interface SecretReference {
  name: string; // Logical name used in code
  envVariable: string; // Environment variable name in .env
}

/** Complete workflow definition */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  globalConfig: GlobalConfig;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// ABI TYPES (for EVM interactions)
// =============================================================================

/** ABI parameter definition */
export interface AbiParameter {
  name: string;
  type: string; // "address", "uint256", "bytes32", "tuple", etc.
  indexed?: boolean; // For event parameters
  components?: AbiParameter[]; // For tuple/struct types
}

/** ABI function definition */
export interface AbiFunction {
  type: "function";
  name: string;
  inputs: AbiParameter[];
  outputs: AbiParameter[];
  stateMutability: "view" | "pure" | "nonpayable" | "payable";
}

/** ABI event definition */
export interface AbiEvent {
  type: "event";
  name: string;
  inputs: AbiParameter[];
}

/** EVM argument - can be literal or reference to previous node output */
export interface EvmArg {
  type: "literal" | "reference";
  value: string; // Literal value OR "{{nodeId.field}}" reference
  abiType: string; // Solidity type: "address", "uint256", etc.
}

// =============================================================================
// TRIGGER NODES (Entry Points)
// =============================================================================

/** Cron Trigger - schedule-based execution */
export interface CronTriggerConfig {
  schedule: string; // 6-field cron: "0 */10 * * * *" (min 30s interval)
  timezone?: string; // IANA timezone: "America/New_York" (default UTC)
}

export type CronTriggerNode = BaseNode<"cronTrigger", CronTriggerConfig>;

export interface CronTriggerOutput {
  triggeredAt: number; // Unix timestamp
}

// -----------------------------------------------------------------------------

/** HTTP Trigger - webhook-based execution */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";

export type WebhookAuth =
  | { type: "none" }
  | { type: "evmSignature"; authorizedAddresses: string[] };

export type WebhookResponseMode = "immediate" | "lastNode" | "respondNode";

export interface HttpTriggerConfig {
  httpMethod: HttpMethod;
  path?: string; // Custom path suffix (auto-generated base)
  authentication: WebhookAuth;
  responseMode: WebhookResponseMode;
  responseCode?: number; // Custom status code (default 200)
  responseHeaders?: Record<string, string>;
  allowedOrigins?: string[]; // CORS origins
}

export type HttpTriggerNode = BaseNode<"httpTrigger", HttpTriggerConfig>;

export interface HttpTriggerOutput {
  payload: unknown;
  headers: Record<string, string>;
  method: string;
}

// -----------------------------------------------------------------------------

/** EVM Log Trigger - blockchain event-based execution */
export interface EvmLogTriggerConfig {
  chainSelectorName: ChainSelectorName;
  contractAddresses: string[]; // Max 5 per CRE
  eventSignature: string; // "Transfer(address,address,uint256)"
  eventAbi: AbiEvent;
  topicFilters?: {
    topic1?: string[]; // Indexed param filters (max 10 values each)
    topic2?: string[];
    topic3?: string[];
  };
  blockConfirmation?: "latest" | "finalized"; // Finality preference (default 'finalized')
}

export type EvmLogTriggerNode = BaseNode<"evmLogTrigger", EvmLogTriggerConfig>;

export interface EvmLogTriggerOutput {
  blockNumber: string; // bigint as string for JSON serialization
  transactionHash: string;
  logIndex: number;
  eventArgs: Record<string, unknown>;
}

// =============================================================================
// ACTION NODES (Capabilities)
// =============================================================================

/** HTTP Request - fetch/send data to external APIs */
export type HttpAuthConfig =
  | { type: "none" }
  | { type: "bearerToken"; tokenSecret: string };

export interface HttpRequestConfig {
  method: HttpMethod;
  url: string; // Supports {{variable}} interpolation
  authentication?: HttpAuthConfig;
  headers?: Record<string, string>;
  queryParameters?: Record<string, string>;
  body?: {
    contentType: "json" | "formUrlEncoded" | "raw";
    data: string; // Template with {{variables}}
  };
  cacheMaxAge?: number; // Seconds (max 600 per CRE)
  timeout?: number; // ms (max 10000 per CRE)
  expectedStatusCodes?: number[]; // Default [200]
  responseFormat?: "json" | "text" | "binary";
  followRedirects?: boolean; // Default true
  ignoreSSL?: boolean; // For dev/testing
}

export type HttpRequestNode = BaseNode<"httpRequest", HttpRequestConfig>;

export interface HttpRequestOutput {
  statusCode: number;
  body: string; // Base64 encoded (per CRE)
  headers: Record<string, string>;
}

// -----------------------------------------------------------------------------

/** EVM Read - read from smart contract (view/pure functions) */
export type BlockNumber = "latest" | "finalized" | string; // string for custom bigint

export interface EvmReadConfig {
  chainSelectorName: ChainSelectorName;
  contractAddress: string;
  abi: AbiFunction;
  functionName: string;
  args: EvmArg[];
  fromAddress?: string; // Sender address (default zero address)
  blockNumber?: BlockNumber;
}

export type EvmReadNode = BaseNode<"evmRead", EvmReadConfig>;

export type EvmReadOutput = Record<string, unknown>; // Decoded return values

// -----------------------------------------------------------------------------

/** EVM Write - write to blockchain via CRE Forwarder */
export interface EvmWriteConfig {
  chainSelectorName: ChainSelectorName;
  receiverAddress: string; // Consumer contract address (must implement IReceiver)
  gasLimit: string; // Max "5000000" per CRE
  abiParams: AbiParameter[];
  dataMapping: EvmArg[];
  value?: string; // Native currency amount (wei as string)
}

export type EvmWriteNode = BaseNode<"evmWrite", EvmWriteConfig>;

export interface EvmWriteOutput {
  txHash: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
}

// -----------------------------------------------------------------------------

/** Get Secret - retrieve secure credentials */
export interface GetSecretConfig {
  secretName: string; // Logical name from secrets.yaml
}

export type GetSecretNode = BaseNode<"getSecret", GetSecretConfig>;

export interface GetSecretOutput {
  value: string;
}

// =============================================================================
// TRANSFORM NODES (Data Processing)
// =============================================================================

/** Code Node - user-defined TypeScript logic */
export type CodeExecutionMode = "runOnceForAll" | "runOnceForEach";

export interface CodeNodeConfig {
  code: string;
  language?: "typescript"; // Explicit, future-proof (default 'typescript')
  executionMode: CodeExecutionMode;
  inputVariables: string[];
  timeout?: number; // Max execution time (ms)
}

export type CodeNodeNode = BaseNode<"codeNode", CodeNodeConfig>;

// Output type is dynamic based on user code

// -----------------------------------------------------------------------------

/** JSON Parse - parse HTTP response body */
export interface JsonParseConfig {
  sourcePath?: string; // JSONPath to extract specific data
  strict?: boolean; // Throw on invalid JSON (default true)
}

export type JsonParseNode = BaseNode<"jsonParse", JsonParseConfig>;

// Output type is the parsed JSON structure

// -----------------------------------------------------------------------------

/** ABI Encode - encode data for EVM write */
export interface AbiEncodeConfig {
  abiParams: AbiParameter[];
  dataMapping: {
    paramName: string;
    source: string; // "{{previousNode.fieldName}}"
  }[];
}

export type AbiEncodeNode = BaseNode<"abiEncode", AbiEncodeConfig>;

export interface AbiEncodeOutput {
  encoded: string; // Hex-encoded bytes
}

// -----------------------------------------------------------------------------

/** ABI Decode - decode data from EVM read */
export interface AbiDecodeConfig {
  abiParams: AbiParameter[];
  outputNames: string[];
}

export type AbiDecodeNode = BaseNode<"abiDecode", AbiDecodeConfig>;

export type AbiDecodeOutput = Record<string, unknown>;

// -----------------------------------------------------------------------------

/** Merge - combine multiple inputs into one */
export type MergeStrategy =
  | { mode: "append" }
  | {
      mode: "matchingFields";
      joinFields: string[];
      outputType:
        | "keepMatches"
        | "keepNonMatches"
        | "keepAll"
        | "enrichInput1"
        | "enrichInput2";
    }
  | { mode: "position"; includeUnpaired?: boolean }
  | { mode: "combinations" }
  | { mode: "custom"; code: string };

export interface MergeConfig {
  strategy: MergeStrategy;
  numberOfInputs?: number; // Default 2, max 5
  clashHandling?: "preferInput1" | "preferInput2" | "addSuffix";
}

export type MergeNode = BaseNode<"merge", MergeConfig>;

// =============================================================================
// CONTROL FLOW NODES
// =============================================================================

/** Comparison operators for structured conditions */
export type ComparisonOperator =
  | "equals"
  | "notEquals"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "regex"
  | "notRegex"
  | "exists"
  | "notExists"
  | "isEmpty"
  | "isNotEmpty";

export interface Condition {
  field: string; // "input.fieldName" or "{{nodeId.field}}"
  operator: ComparisonOperator;
  value?: string; // Not needed for exists/isEmpty operators
}

/** Filter - remove items matching a condition */
export interface FilterConfig {
  conditions: Condition[];
  combineWith: "and" | "or";
}

export type FilterNode = BaseNode<"filter", FilterConfig>;

// Output: filtered array with non-matching items removed

// -----------------------------------------------------------------------------

/** If - route to different branches based on a true/false condition */
export interface IfConfig {
  conditions: Condition[];
  combineWith: "and" | "or";
}

export type IfNode = BaseNode<"if", IfConfig>;

// Output handles: "true", "false"

// =============================================================================
// AI NODES
// =============================================================================

/** AI Node - call an AI model for inference */
export interface AINodeConfig {
  provider: string; // "openai" | "anthropic" | "custom"
  baseUrl: string;
  model: string;
  apiKeySecret: string; // References secret name
  systemPrompt: string;
  userPrompt: string; // Template with {{variables}}
  temperature?: number; // 0-2 (default 0.7)
  maxTokens?: number; // Max output tokens
  responseFormat?: "text" | "json";
  timeout?: number; // ms
  maxRetries?: number; // Default 3
}

export type AINode = BaseNode<"ai", AINodeConfig>;

// =============================================================================
// OUTPUT NODES (Termination)
// =============================================================================

/** Return - end workflow with a value */
export interface ReturnConfig {
  returnExpression: string; // What to return: "result" or custom expression
}

export type ReturnNode = BaseNode<"return", ReturnConfig>;

// -----------------------------------------------------------------------------

/** Error - terminate with error */
export interface ErrorConfig {
  errorMessage: string; // Error message template
}

export type ErrorNode = BaseNode<"error", ErrorConfig>;

// =============================================================================
// TOKENIZATION-SPECIFIC NODES (Convenience Wrappers)
// =============================================================================

/** Mint Token - convenience wrapper for token minting */
export interface MintTokenConfig {
  chainSelectorName: ChainSelectorName;
  tokenContractAddress: string;
  tokenAbi: AbiFunction; // mint(address,uint256) ABI
  recipientSource: string; // "{{kycNode.walletAddress}}"
  amountSource: string; // "{{calculateNode.amount}}"
  gasLimit: string;
}

export type MintTokenNode = BaseNode<"mintToken", MintTokenConfig>;

// Compiler expands this to: ABI Encode -> EVM Write

// -----------------------------------------------------------------------------

/** Burn Token - convenience wrapper for token burning */
export interface BurnTokenConfig {
  chainSelectorName: ChainSelectorName;
  tokenContractAddress: string;
  tokenAbi: AbiFunction; // burn(address,uint256) ABI
  fromSource: string;
  amountSource: string;
  gasLimit: string;
}

export type BurnTokenNode = BaseNode<"burnToken", BurnTokenConfig>;

// -----------------------------------------------------------------------------

/** Transfer Token - convenience wrapper for token transfer */
export interface TransferTokenConfig {
  chainSelectorName: ChainSelectorName;
  tokenContractAddress: string;
  tokenAbi: AbiFunction; // transfer(address,uint256) ABI
  toSource: string;
  amountSource: string;
  gasLimit: string;
}

export type TransferTokenNode = BaseNode<"transferToken", TransferTokenConfig>;

// =============================================================================
// REGULATION NODES
// =============================================================================

/** Check KYC - verify user KYC status */
export interface CheckKycConfig {
  providerUrl: string; // KYC API endpoint
  apiKeySecretName: string; // Secret reference for API key
  walletAddressSource: string; // Where to get wallet address
}

export type CheckKycNode = BaseNode<"checkKyc", CheckKycConfig>;

export interface CheckKycOutput {
  isApproved: boolean;
  kycLevel: number;
  expiresAt?: string;
}

// Compiler expands this to: Get Secret -> HTTP POST -> JSON Parse -> Transform

// -----------------------------------------------------------------------------

/** Check Balance - check token balance */
export interface CheckBalanceConfig {
  chainSelectorName: ChainSelectorName;
  tokenContractAddress: string;
  tokenAbi: AbiFunction; // balanceOf(address) ABI
  addressSource: string;
}

export type CheckBalanceNode = BaseNode<"checkBalance", CheckBalanceConfig>;

export interface CheckBalanceOutput {
  balance: string; // bigint as string
}

// =============================================================================
// NODE TYPE UNION
// =============================================================================

/** All possible node types */
export type NodeType =
  // Triggers
  | "cronTrigger"
  | "httpTrigger"
  | "evmLogTrigger"
  // Actions
  | "httpRequest"
  | "evmRead"
  | "evmWrite"
  | "getSecret"
  // Transforms
  | "codeNode"
  | "jsonParse"
  | "abiEncode"
  | "abiDecode"
  | "merge"
  // Control Flow
  | "filter"
  | "if"
  // AI
  | "ai"
  // Output
  | "return"
  | "error"
  // Tokenization
  | "mintToken"
  | "burnToken"
  | "transferToken"
  // Regulation
  | "checkKyc"
  | "checkBalance";

/** Category groupings for React Flow component lookup */
export type NodeCategory =
  | "trigger"
  | "action"
  | "transform"
  | "controlFlow"
  | "ai"
  | "output"
  | "tokenization"
  | "regulation";

/** Maps each NodeType to its NodeCategory */
export const NODE_TYPE_TO_CATEGORY: Record<NodeType, NodeCategory> = {
  // Triggers
  cronTrigger: "trigger",
  httpTrigger: "trigger",
  evmLogTrigger: "trigger",
  // Actions
  httpRequest: "action",
  evmRead: "action",
  evmWrite: "action",
  getSecret: "action",
  // Transforms
  codeNode: "transform",
  jsonParse: "transform",
  abiEncode: "transform",
  abiDecode: "transform",
  merge: "transform",
  // Control Flow
  filter: "controlFlow",
  if: "controlFlow",
  // AI
  ai: "ai",
  // Output
  return: "output",
  error: "output",
  // Tokenization
  mintToken: "tokenization",
  burnToken: "tokenization",
  transferToken: "tokenization",
  // Regulation
  checkKyc: "regulation",
  checkBalance: "regulation",
};

/** Get the category for a given NodeType */
export function getNodeCategory(nodeType: NodeType): NodeCategory {
  return NODE_TYPE_TO_CATEGORY[nodeType];
}

/** Union of all workflow nodes */
export type WorkflowNode =
  // Triggers
  | CronTriggerNode
  | HttpTriggerNode
  | EvmLogTriggerNode
  // Actions
  | HttpRequestNode
  | EvmReadNode
  | EvmWriteNode
  | GetSecretNode
  // Transforms
  | CodeNodeNode
  | JsonParseNode
  | AbiEncodeNode
  | AbiDecodeNode
  | MergeNode
  // Control Flow
  | FilterNode
  | IfNode
  // AI
  | AINode
  // Output
  | ReturnNode
  | ErrorNode
  // Tokenization
  | MintTokenNode
  | BurnTokenNode
  | TransferTokenNode
  // Regulation
  | CheckKycNode
  | CheckBalanceNode;

// =============================================================================
// TYPE GUARDS
// =============================================================================

/** Check if a node is a trigger node (entry point) */
export function isTriggerNode(
  node: WorkflowNode,
): node is CronTriggerNode | HttpTriggerNode | EvmLogTriggerNode {
  return ["cronTrigger", "httpTrigger", "evmLogTrigger"].includes(node.type);
}

/** Check if a node is an action node (capability) */
export function isActionNode(node: WorkflowNode): boolean {
  return ["httpRequest", "evmRead", "evmWrite", "getSecret"].includes(
    node.type,
  );
}

/** Check if a node is a transform node */
export function isTransformNode(node: WorkflowNode): boolean {
  return ["codeNode", "jsonParse", "abiEncode", "abiDecode", "merge"].includes(
    node.type,
  );
}

/** Check if a node is a control flow node */
export function isControlFlowNode(node: WorkflowNode): boolean {
  return ["filter", "if"].includes(node.type);
}

/** Check if a node is an AI node */
export function isAINode(node: WorkflowNode): boolean {
  return ["ai"].includes(node.type);
}

/** Check if a node is an output node (termination) */
export function isOutputNode(node: WorkflowNode): boolean {
  return ["return", "error"].includes(node.type);
}

/** Check if a node is a tokenization-specific node */
export function isTokenizationNode(node: WorkflowNode): boolean {
  return ["mintToken", "burnToken", "transferToken"].includes(node.type);
}

/** Check if a node is a regulation node */
export function isRegulationNode(node: WorkflowNode): boolean {
  return ["checkKyc", "checkBalance"].includes(node.type);
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/** Cron expression validation (6-field format, min 30s interval) */
export const CRON_REGEX =
  /^(\d+|\*|\*\/\d+)\s+(\d+|\*|\*\/\d+)\s+(\d+|\*|\*\/\d+)\s+(\d+|\*|\*\/\d+)\s+(\d+|\*|\*\/\d+)\s+(\d+|\*|\*\/\d+)$/;

/** Ethereum address validation */
export const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export type { ChainSelectorName } from "../supportedChain";

// =============================================================================
// EXAMPLE WORKFLOW
// =============================================================================

/**
 * Example: A simple tokenization workflow
 *
 * [Cron Trigger] -> [HTTP Request (KYC API)] -> [JSON Parse] -> [If (isApproved)]
 *                                                                |
 *                                                    true -------+------- false
 *                                                      |                    |
 *                                              [Mint Token]            [Return]
 *                                                      |
 *                                               [Return]
 */
export const exampleWorkflow: Workflow = {
  id: "example-tokenization-workflow",
  name: "KYC-Gated Token Minting",
  description: "Mint tokens only for KYC-approved users",
  version: "1.0.0",
  globalConfig: {
    isTestnet: true,
    secrets: [],
    rpcs: [
      {
        chainName: "ethereum-testnet-sepolia",
        url: "https://0xrpc.io/sep",
      },
    ],
  },
  nodes: [
    {
      id: "trigger-1",
      type: "cronTrigger",
      position: { x: 100, y: 200 },
      data: {
        label: "Every 10 minutes",
        config: { schedule: "0 */10 * * * *", timezone: "UTC" },
      },
    },
    {
      id: "http-1",
      type: "httpRequest",
      position: { x: 300, y: 200 },
      data: {
        label: "Check KYC Status",
        config: {
          method: "GET",
          url: "https://kyc-api.example.com/status/{{walletAddress}}",
          authentication: {
            type: "bearerToken",
            tokenSecret: "KYC_API_KEY",
          },
          cacheMaxAge: 60,
          responseFormat: "json",
        },
      },
    },
    {
      id: "parse-1",
      type: "jsonParse",
      position: { x: 500, y: 200 },
      data: {
        label: "Parse KYC Response",
        config: {},
      },
    },
    {
      id: "condition-1",
      type: "if",
      position: { x: 700, y: 200 },
      data: {
        label: "Is Approved?",
        config: {
          conditions: [
            { field: "input.isApproved", operator: "equals", value: "true" },
          ],
          combineWith: "and",
        },
      },
    },
    {
      id: "mint-1",
      type: "mintToken",
      position: { x: 900, y: 100 },
      data: {
        label: "Mint Tokens",
        config: {
          chainSelectorName: "ethereum-testnet-sepolia",
          tokenContractAddress: "0x...",
          tokenAbi: {
            type: "function",
            name: "mint",
            inputs: [
              { name: "to", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [],
            stateMutability: "nonpayable",
          },
          recipientSource: "{{parse-1.walletAddress}}",
          amountSource: "{{parse-1.tokenAmount}}",
          gasLimit: "500000",
        },
      },
    },
    {
      id: "return-1",
      type: "return",
      position: { x: 1100, y: 100 },
      data: {
        label: "Return Success",
        config: { returnExpression: '"Minted successfully"' },
      },
    },
    {
      id: "return-2",
      type: "return",
      position: { x: 1100, y: 300 },
      data: {
        label: "Return Rejected",
        config: { returnExpression: '"KYC not approved"' },
      },
    },
  ],
  edges: [
    { id: "e1", source: "trigger-1", target: "http-1" },
    { id: "e2", source: "http-1", target: "parse-1" },
    { id: "e3", source: "parse-1", target: "condition-1" },
    { id: "e4", source: "condition-1", target: "mint-1", sourceHandle: "true" },
    { id: "e5", source: "condition-1", target: "return-2", sourceHandle: "false" },
    { id: "e6", source: "mint-1", target: "return-1" },
  ],
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};
