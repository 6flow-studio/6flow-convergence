/**
 * Output Schema Registry
 *
 * Maps each NodeType to its known output fields so the frontend can display
 * upstream node outputs and power expression autocomplete ({{nodeId.field}}).
 *
 * Three schema modes:
 *   - "static"         — fields fully known from the node type alone
 *   - "dynamic"        — fields determined at runtime (Code Node, JSON Parse)
 *   - "config-derived" — fields inferred from the node's config (EVM Read, ABI Decode)
 *   - "passthrough"    — output mirrors input (If, Filter, Merge)
 */

import type { NodeType } from "./node";

/** A single field in a node's output */
export interface OutputField {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "unknown";
  description?: string;
}

export type SchemaMode = "static" | "dynamic" | "config-derived" | "passthrough";

/** Output schema for a node type */
export interface NodeOutputSchema {
  schemaMode: SchemaMode;
  fields: OutputField[];
}

// ---------------------------------------------------------------------------
// Static schema definitions (derived from *Output interfaces in node.ts)
// ---------------------------------------------------------------------------

const cronTriggerSchema: NodeOutputSchema = {
  schemaMode: "static",
  fields: [
    { name: "triggeredAt", type: "number", description: "Unix timestamp" },
  ],
};

const httpTriggerSchema: NodeOutputSchema = {
  schemaMode: "static",
  fields: [
    { name: "payload", type: "unknown", description: "Request body" },
    { name: "headers", type: "object", description: "Request headers" },
    { name: "method", type: "string", description: "HTTP method" },
  ],
};

const evmLogTriggerSchema: NodeOutputSchema = {
  schemaMode: "static",
  fields: [
    { name: "blockNumber", type: "string", description: "Block number (bigint)" },
    { name: "transactionHash", type: "string", description: "Transaction hash" },
    { name: "logIndex", type: "number", description: "Log index in block" },
    { name: "eventArgs", type: "object", description: "Decoded event arguments" },
  ],
};

const httpRequestSchema: NodeOutputSchema = {
  schemaMode: "static",
  fields: [
    { name: "statusCode", type: "number", description: "HTTP status code" },
    { name: "body", type: "string", description: "Response body (base64)" },
    { name: "headers", type: "object", description: "Response headers" },
  ],
};

const evmWriteSchema: NodeOutputSchema = {
  schemaMode: "static",
  fields: [
    { name: "txHash", type: "string", description: "Transaction hash" },
    { name: "status", type: "string", description: "SUCCESS | FAILED | PENDING" },
  ],
};

const getSecretSchema: NodeOutputSchema = {
  schemaMode: "static",
  fields: [
    { name: "value", type: "string", description: "Secret value" },
  ],
};

const abiEncodeSchema: NodeOutputSchema = {
  schemaMode: "static",
  fields: [
    { name: "encoded", type: "string", description: "Hex-encoded bytes" },
  ],
};

const checkKycSchema: NodeOutputSchema = {
  schemaMode: "static",
  fields: [
    { name: "isApproved", type: "boolean", description: "KYC approval status" },
    { name: "kycLevel", type: "number", description: "KYC verification level" },
    { name: "expiresAt", type: "string", description: "Expiry timestamp (optional)" },
  ],
};

const checkBalanceSchema: NodeOutputSchema = {
  schemaMode: "static",
  fields: [
    { name: "balance", type: "string", description: "Token balance (bigint)" },
  ],
};

const tokenWriteSchema: NodeOutputSchema = {
  schemaMode: "static",
  fields: [
    { name: "txHash", type: "string", description: "Transaction hash" },
    { name: "status", type: "string", description: "SUCCESS | FAILED | PENDING" },
  ],
};

const aiSchema: NodeOutputSchema = {
  schemaMode: "static",
  fields: [
    { name: "response", type: "string", description: "AI model response" },
  ],
};

const stopAndErrorSchema: NodeOutputSchema = {
  schemaMode: "static",
  fields: [], // terminal node — no output
};

// Dynamic schemas — fields unknown at design time
const dynamicSchema: NodeOutputSchema = {
  schemaMode: "dynamic",
  fields: [],
};

// Passthrough schemas — output mirrors input
const passthroughSchema: NodeOutputSchema = {
  schemaMode: "passthrough",
  fields: [],
};

// Config-derived schemas — fields resolved from node config
const configDerivedSchema: NodeOutputSchema = {
  schemaMode: "config-derived",
  fields: [],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const NODE_OUTPUT_SCHEMAS: Record<NodeType, NodeOutputSchema> = {
  // Triggers
  cronTrigger: cronTriggerSchema,
  httpTrigger: httpTriggerSchema,
  evmLogTrigger: evmLogTriggerSchema,
  // Actions
  httpRequest: httpRequestSchema,
  evmRead: configDerivedSchema,
  evmWrite: evmWriteSchema,
  getSecret: getSecretSchema,
  // Transforms
  codeNode: dynamicSchema,
  jsonParse: dynamicSchema,
  abiEncode: abiEncodeSchema,
  abiDecode: configDerivedSchema,
  merge: passthroughSchema,
  // Control Flow
  filter: passthroughSchema,
  if: passthroughSchema,
  stopAndError: stopAndErrorSchema,
  // AI
  ai: aiSchema,
  // Tokenization
  mintToken: tokenWriteSchema,
  burnToken: tokenWriteSchema,
  transferToken: tokenWriteSchema,
  // Regulation
  checkKyc: checkKycSchema,
  checkBalance: checkBalanceSchema,
};

// ---------------------------------------------------------------------------
// Config-derived resolver
// ---------------------------------------------------------------------------

/**
 * Resolve output fields for config-derived nodes.
 * Call this for nodes where schemaMode === "config-derived".
 */
export function resolveOutputFields(
  nodeType: NodeType,
  config: Record<string, unknown>,
): OutputField[] {
  switch (nodeType) {
    case "evmRead": {
      const abi = config.abi as
        | { outputs?: { name: string; type: string }[] }
        | undefined;
      return (abi?.outputs ?? []).map((o) => ({
        name: o.name || "result",
        type: "unknown" as const,
        description: `ABI output (${o.type})`,
      }));
    }
    case "abiDecode": {
      const names = (config.outputNames as string[]) ?? [];
      return names.map((name) => ({
        name,
        type: "unknown" as const,
        description: "Decoded ABI parameter",
      }));
    }
    default:
      return [];
  }
}
