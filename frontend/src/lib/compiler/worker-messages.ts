import type {
  CompileWorkflowResult,
  CompilerUiError,
} from "./compiler-types";

export interface CompilerWorkerPayloadMap {
  init: Record<string, never>;
  validate_node: {
    nodeJson: string;
    globalConfigJson: string;
  };
  validate_workflow: {
    workflowJson: string;
  };
  compile_workflow: {
    workflowJson: string;
  };
}

export interface CompilerWorkerSuccessPayloadMap {
  init: {
    ready: true;
  };
  validate_node: {
    errors: CompilerUiError[];
  };
  validate_workflow: {
    errors: CompilerUiError[];
  };
  compile_workflow: CompileWorkflowResult;
}

export type CompilerWorkerRequestType = keyof CompilerWorkerPayloadMap;

type CompilerWorkerRequestByType<T extends CompilerWorkerRequestType> = {
  id: number;
  type: T;
  payload: CompilerWorkerPayloadMap[T];
};

export type CompilerWorkerRequest<
  T extends CompilerWorkerRequestType = CompilerWorkerRequestType,
> = CompilerWorkerRequestByType<T>;

export type CompilerWorkerRequestUnion = {
  [K in CompilerWorkerRequestType]: CompilerWorkerRequestByType<K>;
}[CompilerWorkerRequestType];

export type CompilerWorkerSuccessResponse<
  T extends CompilerWorkerRequestType = CompilerWorkerRequestType,
> = {
  id: number;
  ok: true;
  type: T;
  payload: CompilerWorkerSuccessPayloadMap[T];
};

export type CompilerWorkerSuccessResponseUnion = {
  [K in CompilerWorkerRequestType]: CompilerWorkerSuccessResponse<K>;
}[CompilerWorkerRequestType];

export type CompilerWorkerErrorResponse = {
  id: number;
  ok: false;
  type: CompilerWorkerRequestType;
  error: string;
};

export type CompilerWorkerResponse =
  | CompilerWorkerSuccessResponseUnion
  | CompilerWorkerErrorResponse;
