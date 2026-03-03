export const AI_PROVIDERS = [
  {
    value: "gpt-5.2",
    label: "GPT-5.2",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    provider: "OpenAI",
  },
  {
    value: "gpt-5-mini",
    label: "GPT-5 Mini",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    provider: "OpenAI",
  },
  {
    value: "gpt-5-nano",
    label: "GPT-5 Nano",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    provider: "OpenAI",
  },
  {
    value: "claude-opus-4.6",
    label: "Claude Opus 4.6",
    baseUrl: "https://api.anthropic.com/v1/messages",
    provider: "Anthropic",
  },
  {
    value: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    baseUrl: "https://api.anthropic.com/v1/messages",
    provider: "Anthropic",
  },
  {
    value: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    baseUrl: "https://api.anthropic.com/v1/messages",
    provider: "Anthropic",
  },
  {
    value: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    baseUrl:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
    provider: "Google",
  },
  {
    value: "gemini-3-pro-preview",
    label: "Gemini 3 Pro",
    baseUrl:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent",
    provider: "Google",
  },
  {
    value: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    baseUrl:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
    provider: "Google",
  },
];

type AIProviderName = "OpenAI" | "Anthropic" | "Google";

interface AIOutputSchemaEntry {
  primaryTextPath: string;
  finishReasonPath: string;
  rolePath?: string;
  blockReasonPath?: string;
  usagePaths: {
    inputTokens?: string;
    outputTokens?: string;
    totalTokens?: string;
  };
}

export const AI_OUTPUT_SCHEMA = {
  OpenAI: {
    primaryTextPath: "choices[0].message.content",
    finishReasonPath: "choices[0].finish_reason",
    rolePath: "choices[0].message.role",
    usagePaths: {
      inputTokens: "usage.prompt_tokens",
      outputTokens: "usage.completion_tokens",
      totalTokens: "usage.total_tokens",
    },
  },
  Anthropic: {
    primaryTextPath: "content[0].text",
    finishReasonPath: "stop_reason",
    rolePath: "role",
    usagePaths: {
      inputTokens: "usage.input_tokens",
      outputTokens: "usage.output_tokens",
    },
  },
  Google: {
    primaryTextPath: "candidates[0].content.parts[0].text",
    finishReasonPath: "candidates[0].finishReason",
    rolePath: "candidates[0].content.role",
    blockReasonPath: "promptFeedback.blockReason",
    usagePaths: {
      inputTokens: "usageMetadata.promptTokenCount",
      outputTokens: "usageMetadata.candidatesTokenCount",
      totalTokens: "usageMetadata.totalTokenCount",
    },
  },
} as const satisfies Record<AIProviderName, AIOutputSchemaEntry>;

/* ── Build a DataSchema tree from an AIOutputSchemaEntry ── */

import type { DataSchema, DataSchemaField } from "./model/node";

interface TrieNode {
  children: Map<string, TrieNode>;
  isArray: boolean;
}

/** Parse a dot-bracket path like "choices[0].message.content" into segments */
function parsePath(raw: string): string[] {
  return raw.replace(/\[(\d+)\]/g, ".$1").split(".");
}

/** Insert a leaf at the given path segments into a mutable trie */
function insertPath(root: Map<string, TrieNode>, segments: string[]) {
  let current = root;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const nextIsIndex = i + 1 < segments.length && /^\d+$/.test(segments[i + 1]);

    if (!current.has(seg)) {
      current.set(seg, { children: new Map(), isArray: nextIsIndex });
    }
    const node = current.get(seg)!;
    if (nextIsIndex) node.isArray = true;
    current = node.children;
  }
}

function buildSchema(
  map: Map<string, TrieNode>,
  basePath: string,
): DataSchemaField[] {
  const fields: DataSchemaField[] = [];

  for (const [key, node] of map) {
    // Skip numeric indices — recurse into the index's children.
    // The parent array node already appended [0] to basePath, so pass it through unchanged.
    if (/^\d+$/.test(key)) {
      return buildSchema(node.children, basePath);
    }

    const path = basePath ? `${basePath}.${key}` : key;

    if (node.children.size === 0) {
      fields.push({ key, path, schema: { type: "string", path } });
    } else if (node.isArray) {
      const itemFields = buildSchema(node.children, `${path}[0]`);
      fields.push({
        key,
        path,
        schema: {
          type: "array",
          path,
          itemSchema: { type: "object", path: `${path}[]`, fields: itemFields },
        },
      });
    } else {
      const childFields = buildSchema(node.children, path);
      fields.push({
        key,
        path,
        schema: { type: "object", path, fields: childFields },
      });
    }
  }

  return fields;
}

export function getAIOutputDataSchema(provider: AIProviderName): DataSchema {
  const entry: AIOutputSchemaEntry = AI_OUTPUT_SCHEMA[provider];

  const allPaths: string[] = [entry.primaryTextPath, entry.finishReasonPath];
  if (entry.rolePath) allPaths.push(entry.rolePath);
  if (entry.blockReasonPath) allPaths.push(entry.blockReasonPath);
  if (entry.usagePaths.inputTokens) allPaths.push(entry.usagePaths.inputTokens);
  if (entry.usagePaths.outputTokens) allPaths.push(entry.usagePaths.outputTokens);
  if (entry.usagePaths.totalTokens) allPaths.push(entry.usagePaths.totalTokens);

  const root = new Map<string, TrieNode>();
  for (const p of allPaths) {
    insertPath(root, parsePath(p));
  }

  return { type: "object", path: "", fields: buildSchema(root, "") };
}
