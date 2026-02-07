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

// =============================================================================
// BASE TYPES
// =============================================================================

/** Position type from React Flow */
export interface Position {
  x: number;
  y: number;
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
}

/** Edge connecting two nodes */
export interface WorkflowEdge {
  id: string;
  source: string;        // Source node ID
  target: string;        // Target node ID
  sourceHandle?: string; // Output port name (for multi-output nodes like IfElse)
  targetHandle?: string; // Input port name (for multi-input nodes like Merge)
}

/** Global workflow configuration */
export interface GlobalConfig {
  isTestnet: boolean;
  defaultChainSelector: string;
  secrets: SecretReference[];
}

/** Reference to a secret in secrets.yaml */
export interface SecretReference {
  name: string;       // Logical name used in code
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
  type: string;        // "address", "uint256", "bytes32", "tuple", etc.
  indexed?: boolean;   // For event parameters
  components?: AbiParameter[]; // For tuple/struct types
}

/** ABI function definition */
export interface AbiFunction {
  type: 'function';
  name: string;
  inputs: AbiParameter[];
  outputs: AbiParameter[];
  stateMutability: 'view' | 'pure' | 'nonpayable' | 'payable';
}

/** ABI event definition */
export interface AbiEvent {
  type: 'event';
  name: string;
  inputs: AbiParameter[];
}

/** EVM argument - can be literal or reference to previous node output */
export interface EvmArg {
  type: 'literal' | 'reference';
  value: string;       // Literal value OR "{{nodeId.field}}" reference
  abiType: string;     // Solidity type: "address", "uint256", etc.
}

// =============================================================================
// TRIGGER NODES (Entry Points)
// =============================================================================

/** Cron Trigger - schedule-based execution */
export interface CronTriggerConfig {
  schedule: string;    // Cron expression: "0 */10 * * * *" (min 30s interval)
}

export type CronTriggerNode = BaseNode<'cronTrigger', CronTriggerConfig>;

export interface CronTriggerOutput {
  triggeredAt: number; // Unix timestamp
}

// -----------------------------------------------------------------------------

/** HTTP Trigger - webhook-based execution */
export interface HttpTriggerConfig {
  authorizedKeys: string[]; // EVM addresses authorized to call this endpoint
}

export type HttpTriggerNode = BaseNode<'httpTrigger', HttpTriggerConfig>;

export interface HttpTriggerOutput {
  payload: unknown;
  headers: Record<string, string>;
  method: string;
}

// -----------------------------------------------------------------------------

/** EVM Log Trigger - blockchain event-based execution */
export interface EvmLogTriggerConfig {
  chainSelectorName: string;    // e.g., "ethereum-testnet-sepolia"
  contractAddress: string;      // "0x..."
  eventSignature: string;       // "Transfer(address,address,uint256)"
  eventAbi: AbiEvent;
  topicFilters?: {
    topic1?: string[];          // Indexed param 1 filter values
    topic2?: string[];          // Indexed param 2 filter values
    topic3?: string[];          // Indexed param 3 filter values
  };
}

export type EvmLogTriggerNode = BaseNode<'evmLogTrigger', EvmLogTriggerConfig>;

export interface EvmLogTriggerOutput {
  blockNumber: string;          // bigint as string for JSON serialization
  transactionHash: string;
  logIndex: number;
  eventArgs: Record<string, unknown>;
}

// =============================================================================
// ACTION NODES (Capabilities)
// =============================================================================

/** HTTP GET - fetch data from external API */
export interface HttpGetConfig {
  url: string;                           // Can include {{variables}} for interpolation
  headers: Record<string, string>;
  cacheMaxAge: number;                   // Seconds (max 600)
  expectedStatusCodes?: number[];        // Default [200]
}

export type HttpGetNode = BaseNode<'httpGet', HttpGetConfig>;

export interface HttpGetOutput {
  statusCode: number;
  body: string;                          // Base64 encoded response body
  headers: Record<string, string>;
}

// -----------------------------------------------------------------------------

/** HTTP POST - send data to external API */
export interface HttpPostConfig {
  url: string;
  headers: Record<string, string>;
  bodyTemplate: string;                  // JSON template with {{variables}}
  cacheMaxAge: number;
}

export type HttpPostNode = BaseNode<'httpPost', HttpPostConfig>;

export interface HttpPostOutput {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}

// -----------------------------------------------------------------------------

/** EVM Read - read from smart contract (view/pure functions) */
export interface EvmReadConfig {
  chainSelectorName: string;
  contractAddress: string;
  abi: AbiFunction;
  functionName: string;
  args: EvmArg[];
  blockNumber?: 'latest' | 'finalized' | number;
}

export type EvmReadNode = BaseNode<'evmRead', EvmReadConfig>;

export type EvmReadOutput = Record<string, unknown>; // Decoded return values

// -----------------------------------------------------------------------------

/** EVM Write - write to blockchain via CRE Forwarder */
export interface EvmWriteConfig {
  chainSelectorName: string;
  receiverAddress: string;               // Consumer contract address (must implement IReceiver)
  gasLimit: string;                      // e.g., "500000"
  abiParams: AbiParameter[];             // Parameters to encode
  dataMapping: EvmArg[];                 // Where data comes from
}

export type EvmWriteNode = BaseNode<'evmWrite', EvmWriteConfig>;

export interface EvmWriteOutput {
  txHash: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
}

// -----------------------------------------------------------------------------

/** Get Secret - retrieve secure credentials */
export interface GetSecretConfig {
  secretName: string;                    // Logical name from secrets.yaml
}

export type GetSecretNode = BaseNode<'getSecret', GetSecretConfig>;

export interface GetSecretOutput {
  value: string;
}

// =============================================================================
// TRANSFORM NODES (Data Processing)
// =============================================================================

/** Code Node - user-defined TypeScript/JavaScript logic */
export interface CodeNodeConfig {
  code: string;                          // User's TypeScript code
  inputVariables: string[];              // Variables available from previous nodes
  outputType: 'object' | 'string' | 'number' | 'boolean';
  timeout?: number;                      // Max execution time (ms)
}

export type CodeNodeNode = BaseNode<'codeNode', CodeNodeConfig>;

// Output type is dynamic based on user code

// -----------------------------------------------------------------------------

/** JSON Parse - parse HTTP response body */
export interface JsonParseConfig {
  sourcePath?: string;                   // Optional JSONPath to extract specific data
}

export type JsonParseNode = BaseNode<'jsonParse', JsonParseConfig>;

// Output type is the parsed JSON structure

// -----------------------------------------------------------------------------

/** ABI Encode - encode data for EVM write */
export interface AbiEncodeConfig {
  abiParams: string;                     // e.g., "uint256 value, address recipient"
  dataMapping: {
    paramName: string;
    source: string;                      // "{{previousNode.fieldName}}"
  }[];
}

export type AbiEncodeNode = BaseNode<'abiEncode', AbiEncodeConfig>;

export interface AbiEncodeOutput {
  encoded: string;                       // Hex-encoded bytes
}

// -----------------------------------------------------------------------------

/** ABI Decode - decode data from EVM read */
export interface AbiDecodeConfig {
  abiParams: string;                     // Types to decode: "uint256, address, bool"
  outputNames: string[];                 // Names for each decoded value
}

export type AbiDecodeNode = BaseNode<'abiDecode', AbiDecodeConfig>;

export type AbiDecodeOutput = Record<string, unknown>;

// -----------------------------------------------------------------------------

/** Merge - combine multiple inputs into one */
export interface MergeConfig {
  strategy: 'object' | 'array' | 'first' | 'custom';
  customCode?: string;                   // If strategy is 'custom'
}

export type MergeNode = BaseNode<'merge', MergeConfig>;

// Input handles: "input1", "input2", "input3", etc.
// Output: merged data based on strategy

// =============================================================================
// CONTROL FLOW NODES
// =============================================================================

/** If/Else - conditional branching */
export interface IfElseConfig {
  condition: string;                     // JavaScript expression: "input.value > 100"
}

export type IfElseNode = BaseNode<'ifElse', IfElseConfig>;

// Output handles: "true", "false"

// -----------------------------------------------------------------------------

/** Switch - multi-path branching */
export interface SwitchConfig {
  expression: string;                    // e.g., "input.status"
  cases: {
    value: string;
    handleName: string;
  }[];
  hasDefault: boolean;
}

export type SwitchNode = BaseNode<'switch', SwitchConfig>;

// Output handles: case handleNames + optionally "default"

// -----------------------------------------------------------------------------

/** Loop - iterate over array */
export interface LoopConfig {
  iterableSource: string;                // e.g., "input.items"
  itemVariable: string;                  // e.g., "item"
  indexVariable: string;                 // e.g., "index"
  maxIterations: number;                 // Safety limit (CRE has execution time limits)
}

export type LoopNode = BaseNode<'loop', LoopConfig>;

// Output handles: "item" (inside loop body), "complete" (after loop finishes)

// =============================================================================
// OUTPUT NODES (Termination)
// =============================================================================

/** Return - end workflow with a value */
export interface ReturnConfig {
  returnExpression: string;              // What to return: "result" or custom expression
}

export type ReturnNode = BaseNode<'return', ReturnConfig>;

// -----------------------------------------------------------------------------

/** Log - debug logging */
export interface LogConfig {
  messageTemplate: string;               // e.g., "Value is {{input.value}}"
}

export type LogNode = BaseNode<'log', LogConfig>;

// -----------------------------------------------------------------------------

/** Error - terminate with error */
export interface ErrorConfig {
  errorMessage: string;                  // Error message template
}

export type ErrorNode = BaseNode<'error', ErrorConfig>;

// =============================================================================
// TOKENIZATION-SPECIFIC NODES (Convenience Wrappers)
// =============================================================================

/** Mint Token - convenience wrapper for token minting */
export interface MintTokenConfig {
  chainSelectorName: string;
  tokenContractAddress: string;
  tokenAbi: AbiFunction;                 // mint(address,uint256) ABI
  recipientSource: string;               // "{{kycNode.walletAddress}}"
  amountSource: string;                  // "{{calculateNode.amount}}"
  gasLimit: string;
}

export type MintTokenNode = BaseNode<'mintToken', MintTokenConfig>;

// Compiler expands this to: ABI Encode -> EVM Write

// -----------------------------------------------------------------------------

/** Burn Token - convenience wrapper for token burning */
export interface BurnTokenConfig {
  chainSelectorName: string;
  tokenContractAddress: string;
  tokenAbi: AbiFunction;                 // burn(address,uint256) ABI
  fromSource: string;
  amountSource: string;
  gasLimit: string;
}

export type BurnTokenNode = BaseNode<'burnToken', BurnTokenConfig>;

// -----------------------------------------------------------------------------

/** Transfer Token - convenience wrapper for token transfer */
export interface TransferTokenConfig {
  chainSelectorName: string;
  tokenContractAddress: string;
  tokenAbi: AbiFunction;                 // transfer(address,uint256) ABI
  toSource: string;
  amountSource: string;
  gasLimit: string;
}

export type TransferTokenNode = BaseNode<'transferToken', TransferTokenConfig>;

// -----------------------------------------------------------------------------

/** Check KYC - verify user KYC status */
export interface CheckKycConfig {
  providerUrl: string;                   // KYC API endpoint
  apiKeySecretName: string;              // Secret reference for API key
  walletAddressSource: string;           // Where to get wallet address
}

export type CheckKycNode = BaseNode<'checkKyc', CheckKycConfig>;

export interface CheckKycOutput {
  isApproved: boolean;
  kycLevel: number;
  expiresAt?: string;
}

// Compiler expands this to: Get Secret -> HTTP POST -> JSON Parse -> Transform

// -----------------------------------------------------------------------------

/** Check Balance - check token balance */
export interface CheckBalanceConfig {
  chainSelectorName: string;
  tokenContractAddress: string;
  tokenAbi: AbiFunction;                 // balanceOf(address) ABI
  addressSource: string;
}

export type CheckBalanceNode = BaseNode<'checkBalance', CheckBalanceConfig>;

export interface CheckBalanceOutput {
  balance: string;                       // bigint as string
}

// =============================================================================
// NODE TYPE UNION
// =============================================================================

/** All possible node types */
export type NodeType =
  // Triggers
  | 'cronTrigger'
  | 'httpTrigger'
  | 'evmLogTrigger'
  // Actions
  | 'httpGet'
  | 'httpPost'
  | 'evmRead'
  | 'evmWrite'
  | 'getSecret'
  // Transforms
  | 'codeNode'
  | 'jsonParse'
  | 'abiEncode'
  | 'abiDecode'
  | 'merge'
  // Control Flow
  | 'ifElse'
  | 'switch'
  | 'loop'
  // Output
  | 'return'
  | 'log'
  | 'error'
  // Tokenization
  | 'mintToken'
  | 'burnToken'
  | 'transferToken'
  | 'checkKyc'
  | 'checkBalance';

/** Union of all workflow nodes */
export type WorkflowNode =
  // Triggers
  | CronTriggerNode
  | HttpTriggerNode
  | EvmLogTriggerNode
  // Actions
  | HttpGetNode
  | HttpPostNode
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
  | IfElseNode
  | SwitchNode
  | LoopNode
  // Output
  | ReturnNode
  | LogNode
  | ErrorNode
  // Tokenization
  | MintTokenNode
  | BurnTokenNode
  | TransferTokenNode
  | CheckKycNode
  | CheckBalanceNode;

// =============================================================================
// TYPE GUARDS
// =============================================================================

/** Check if a node is a trigger node (entry point) */
export function isTriggerNode(node: WorkflowNode): node is CronTriggerNode | HttpTriggerNode | EvmLogTriggerNode {
  return ['cronTrigger', 'httpTrigger', 'evmLogTrigger'].includes(node.type);
}

/** Check if a node is an action node (capability) */
export function isActionNode(node: WorkflowNode): boolean {
  return ['httpGet', 'httpPost', 'evmRead', 'evmWrite', 'getSecret'].includes(node.type);
}

/** Check if a node is a transform node */
export function isTransformNode(node: WorkflowNode): boolean {
  return ['codeNode', 'jsonParse', 'abiEncode', 'abiDecode', 'merge'].includes(node.type);
}

/** Check if a node is a control flow node */
export function isControlFlowNode(node: WorkflowNode): boolean {
  return ['ifElse', 'switch', 'loop'].includes(node.type);
}

/** Check if a node is an output node (termination) */
export function isOutputNode(node: WorkflowNode): boolean {
  return ['return', 'log', 'error'].includes(node.type);
}

/** Check if a node is a tokenization-specific node */
export function isTokenizationNode(node: WorkflowNode): boolean {
  return ['mintToken', 'burnToken', 'transferToken', 'checkKyc', 'checkBalance'].includes(node.type);
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/** Cron expression validation (6-field format, min 30s interval) */
export const CRON_REGEX = /^(\d+|\*|\*\/\d+)\s+(\d+|\*|\*\/\d+)\s+(\d+|\*|\*\/\d+)\s+(\d+|\*|\*\/\d+)\s+(\d+|\*|\*\/\d+)\s+(\d+|\*|\*\/\d+)$/;

/** Ethereum address validation */
export const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** Supported chain selectors for CRE */
export const SUPPORTED_CHAINS = [
  'ethereum-mainnet',
  'ethereum-testnet-sepolia',
  'polygon-mainnet',
  'polygon-testnet-amoy',
  'arbitrum-mainnet',
  'arbitrum-testnet-sepolia',
  'optimism-mainnet',
  'optimism-testnet-sepolia',
  'avalanche-mainnet',
  'avalanche-testnet-fuji',
  'base-mainnet',
  'base-testnet-sepolia',
] as const;

export type ChainSelectorName = typeof SUPPORTED_CHAINS[number];

// =============================================================================
// EXAMPLE WORKFLOW
// =============================================================================

/**
 * Example: A simple tokenization workflow
 *
 * [Cron Trigger] -> [HTTP GET (KYC API)] -> [JSON Parse] -> [If/Else (isApproved)]
 *                                                                |
 *                                                    true -------+------- false
 *                                                      |                    |
 *                                              [Mint Token]              [Log]
 *                                                      |                    |
 *                                               [Return]              [Return]
 */
export const exampleWorkflow: Workflow = {
  id: 'example-tokenization-workflow',
  name: 'KYC-Gated Token Minting',
  description: 'Mint tokens only for KYC-approved users',
  version: '1.0.0',
  globalConfig: {
    isTestnet: true,
    defaultChainSelector: 'ethereum-testnet-sepolia',
    secrets: [
      { name: 'KYC_API_KEY', envVariable: 'KYC_API_KEY_VAR' },
    ],
  },
  nodes: [
    {
      id: 'trigger-1',
      type: 'cronTrigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Every 10 minutes',
        config: { schedule: '0 */10 * * * *' },
      },
    },
    {
      id: 'http-1',
      type: 'httpGet',
      position: { x: 300, y: 200 },
      data: {
        label: 'Check KYC Status',
        config: {
          url: 'https://kyc-api.example.com/status/{{walletAddress}}',
          headers: { 'Authorization': 'Bearer {{secrets.KYC_API_KEY}}' },
          cacheMaxAge: 60,
        },
      },
    },
    {
      id: 'parse-1',
      type: 'jsonParse',
      position: { x: 500, y: 200 },
      data: {
        label: 'Parse KYC Response',
        config: {},
      },
    },
    {
      id: 'condition-1',
      type: 'ifElse',
      position: { x: 700, y: 200 },
      data: {
        label: 'Is Approved?',
        config: { condition: 'input.isApproved === true' },
      },
    },
    {
      id: 'mint-1',
      type: 'mintToken',
      position: { x: 900, y: 100 },
      data: {
        label: 'Mint Tokens',
        config: {
          chainSelectorName: 'ethereum-testnet-sepolia',
          tokenContractAddress: '0x...',
          tokenAbi: {
            type: 'function',
            name: 'mint',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [],
            stateMutability: 'nonpayable',
          },
          recipientSource: '{{parse-1.walletAddress}}',
          amountSource: '{{parse-1.tokenAmount}}',
          gasLimit: '500000',
        },
      },
    },
    {
      id: 'log-1',
      type: 'log',
      position: { x: 900, y: 300 },
      data: {
        label: 'Log Rejection',
        config: { messageTemplate: 'User {{parse-1.walletAddress}} not KYC approved' },
      },
    },
    {
      id: 'return-1',
      type: 'return',
      position: { x: 1100, y: 100 },
      data: {
        label: 'Return Success',
        config: { returnExpression: '"Minted successfully"' },
      },
    },
    {
      id: 'return-2',
      type: 'return',
      position: { x: 1100, y: 300 },
      data: {
        label: 'Return Rejected',
        config: { returnExpression: '"KYC not approved"' },
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'http-1' },
    { id: 'e2', source: 'http-1', target: 'parse-1' },
    { id: 'e3', source: 'parse-1', target: 'condition-1' },
    { id: 'e4', source: 'condition-1', target: 'mint-1', sourceHandle: 'true' },
    { id: 'e5', source: 'condition-1', target: 'log-1', sourceHandle: 'false' },
    { id: 'e6', source: 'mint-1', target: 'return-1' },
    { id: 'e7', source: 'log-1', target: 'return-2' },
  ],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};
