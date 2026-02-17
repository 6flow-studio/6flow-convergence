export type CompilerActionStatus = "idle" | "running" | "success" | "error";

export interface CompilerUiError {
  code: string;
  phase: string;
  message: string;
  node_id: string | null;
}

export interface CompiledFile {
  path: string;
  content: string;
}

export type CompileWorkflowResult =
  | {
      status: "success";
      files: CompiledFile[];
    }
  | {
      status: "errors";
      errors: CompilerUiError[];
    };

export function groupErrorsByNodeId(
  errors: CompilerUiError[]
): Record<string, CompilerUiError[]> {
  return errors.reduce<Record<string, CompilerUiError[]>>((acc, error) => {
    if (!error.node_id) {
      return acc;
    }
    if (!acc[error.node_id]) {
      acc[error.node_id] = [];
    }
    acc[error.node_id].push(error);
    return acc;
  }, {});
}

export function toCompilerUiError(
  message: string,
  code = "W000",
  phase = "Worker",
  node_id: string | null = null
): CompilerUiError {
  return {
    code,
    phase,
    message,
    node_id,
  };
}
