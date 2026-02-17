/// <reference lib="webworker" />

import type {
  CompilerWorkerRequestUnion,
  CompilerWorkerResponse,
} from "./worker-messages";
import type {
  CompileWorkflowResult,
  CompiledFile,
  CompilerUiError,
} from "./compiler-types";
import { toCompilerUiError } from "./compiler-types";

type CompilerWasmModule = {
  default?: (input?: unknown) => Promise<unknown>;
  validate_workflow: (json: string) => unknown;
  validate_node: (nodeJson: string, globalConfigJson: string) => unknown;
  compile_workflow: (json: string) => unknown;
};

let compilerModulePromise: Promise<CompilerWasmModule> | null = null;

function toCompilerAssetUrl(path: string): URL {
  if (self.location.origin && self.location.origin !== "null") {
    return new URL(path, `${self.location.origin}/`);
  }
  return new URL(path, self.location.href);
}

async function ensureCompilerModule(): Promise<CompilerWasmModule> {
  if (compilerModulePromise) {
    return compilerModulePromise;
  }

  compilerModulePromise = (async () => {
    const compilerModuleUrl = toCompilerAssetUrl(
      "/compiler/sixflow_compiler.js"
    ).toString();
    const module = (await import(
      /* webpackIgnore: true */ compilerModuleUrl
    )) as CompilerWasmModule;

    if (typeof module.default === "function") {
      try {
        // Let wasm-bindgen resolve the .wasm path from the imported module URL.
        await module.default();
      } catch {
        // Fallback for runtimes where implicit resolution fails in worker scope.
        await module.default(toCompilerAssetUrl("/compiler/sixflow_compiler_bg.wasm"));
      }
    }

    if (
      typeof module.validate_workflow !== "function" ||
      typeof module.validate_node !== "function" ||
      typeof module.compile_workflow !== "function"
    ) {
      throw new Error("Compiler WASM module is missing required exports");
    }

    return module;
  })();

  return compilerModulePromise;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown worker error";
}

function normalizeError(raw: unknown): CompilerUiError {
  if (!raw || typeof raw !== "object") {
    return toCompilerUiError("Unknown compiler error payload");
  }

  const maybeError = raw as Partial<CompilerUiError>;
  return {
    code: typeof maybeError.code === "string" ? maybeError.code : "W000",
    phase: typeof maybeError.phase === "string" ? maybeError.phase : "Worker",
    message:
      typeof maybeError.message === "string"
        ? maybeError.message
        : "Unknown compiler error",
    node_id: typeof maybeError.node_id === "string" ? maybeError.node_id : null,
  };
}

function normalizeErrors(raw: unknown): CompilerUiError[] {
  if (Array.isArray(raw)) {
    return raw.map(normalizeError);
  }

  if (raw && typeof raw === "object") {
    const maybeObj = raw as Record<string, unknown>;
    if (Array.isArray(maybeObj.errors)) {
      return maybeObj.errors.map(normalizeError);
    }
  }

  return [];
}

function normalizeFile(raw: unknown): CompiledFile | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const maybeFile = raw as Partial<CompiledFile>;
  if (typeof maybeFile.path !== "string" || typeof maybeFile.content !== "string") {
    return null;
  }

  return {
    path: maybeFile.path,
    content: maybeFile.content,
  };
}

function extractArrayCandidates(raw: Record<string, unknown>): unknown[] {
  const knownKeys = [
    "files",
    "errors",
    "data",
    "payload",
    "success",
    "value",
    "0",
  ];

  const candidates: unknown[] = [];
  for (const key of knownKeys) {
    const value = raw[key];
    if (Array.isArray(value)) {
      candidates.push(value);
    }
  }

  if (candidates.length > 0) {
    return candidates;
  }

  for (const value of Object.values(raw)) {
    if (Array.isArray(value)) {
      candidates.push(value);
    }
  }

  return candidates;
}

function normalizeCompileResult(raw: unknown): CompileWorkflowResult {
  if (typeof raw === "string") {
    try {
      return normalizeCompileResult(JSON.parse(raw));
    } catch {
      return {
        status: "errors",
        errors: [toCompilerUiError("Compiler returned non-JSON string output", "W006")],
      };
    }
  }

  if (!raw || typeof raw !== "object") {
    return {
      status: "errors",
      errors: [toCompilerUiError("Compiler returned an empty result", "W002")],
    };
  }

  const obj = raw as Record<string, unknown>;
  const status = typeof obj.status === "string" ? obj.status : null;

  if (status === "success") {
    const candidates = extractArrayCandidates(obj);
    const files = candidates
      .flatMap((value) => value)
      .map(normalizeFile)
      .filter((file): file is CompiledFile => file !== null);

    if (files.length === 0) {
      return {
        status: "errors",
        errors: [
          toCompilerUiError(
            "Compiler reported success but returned no files",
            "W003"
          ),
        ],
      };
    }

    return {
      status: "success",
      files,
    };
  }

  if (status === "errors") {
    const candidates = extractArrayCandidates(obj);
    const errors = candidates
      .flatMap((value) => value)
      .map(normalizeError);

    if (errors.length > 0) {
      return {
        status: "errors",
        errors,
      };
    }

    return {
      status: "errors",
      errors: [toCompilerUiError("Compiler returned an unknown error payload", "W004")],
    };
  }

  return {
    status: "errors",
    errors: [toCompilerUiError("Compiler returned unsupported response format", "W005")],
  };
}

async function handleRequest(request: CompilerWorkerRequestUnion): Promise<unknown> {
  const compiler = await ensureCompilerModule();

  switch (request.type) {
    case "init": {
      return { ready: true };
    }
    case "validate_node": {
      const raw = compiler.validate_node(
        request.payload.nodeJson,
        request.payload.globalConfigJson
      );
      return { errors: normalizeErrors(raw) };
    }
    case "validate_workflow": {
      const raw = compiler.validate_workflow(request.payload.workflowJson);
      return { errors: normalizeErrors(raw) };
    }
    case "compile_workflow": {
      const raw = compiler.compile_workflow(request.payload.workflowJson);
      return normalizeCompileResult(raw);
    }
    default: {
      throw new Error(`Unsupported worker request: ${(request as { type: string }).type}`);
    }
  }
}

self.onmessage = (event: MessageEvent<CompilerWorkerRequestUnion>) => {
  const request = event.data;

  void (async () => {
    try {
      const payload = await handleRequest(request);
      const response: CompilerWorkerResponse = {
        id: request.id,
        ok: true,
        type: request.type,
        payload: payload as never,
      };
      self.postMessage(response);
    } catch (error) {
      const response: CompilerWorkerResponse = {
        id: request.id,
        ok: false,
        type: request.type,
        error: toErrorMessage(error),
      };
      self.postMessage(response);
    }
  })();
};

export {};
