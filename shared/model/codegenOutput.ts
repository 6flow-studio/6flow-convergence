/** A single generated file from the compiler codegen pass. */
export interface GeneratedFile {
  path: string;
  content: string;
}

/** A compiler error returned from validation or compilation. */
export interface CompilerError {
  code: string;
  phase: string;
  message: string;
  node_id: string | null;
}

/** Successful compilation result. */
export interface CompileSuccess {
  status: "success";
  files: GeneratedFile[];
}

/** Failed compilation result. */
export interface CompileFailure {
  status: "errors";
  errors: CompilerError[];
}

/** Discriminated union returned by `compile_workflow()`. */
export type CompileResult = CompileSuccess | CompileFailure;

/** Result of `validate_workflow()` or `validate_node()` — an array of errors (empty = valid). */
export type ValidationResult = CompilerError[];
