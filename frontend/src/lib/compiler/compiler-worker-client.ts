import type {
  CompilerWorkerPayloadMap,
  CompilerWorkerRequest,
  CompilerWorkerRequestType,
  CompilerWorkerResponse,
  CompilerWorkerSuccessPayloadMap,
} from "./worker-messages";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

class CompilerWorkerClient {
  private worker: Worker | null = null;
  private requestId = 1;
  private pending = new Map<number, PendingRequest>();
  private initPromise: Promise<void> | null = null;

  private ensureWorker(): Worker {
    if (this.worker) {
      return this.worker;
    }

    const worker = new Worker(new URL("./compiler.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event: MessageEvent<CompilerWorkerResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.id);
      if (!pending) {
        return;
      }
      this.pending.delete(response.id);

      if (!response.ok) {
        pending.reject(new Error(response.error));
        return;
      }

      pending.resolve(response.payload);
    };

    worker.onerror = (event) => {
      this.rejectAll(new Error(event.message || "Compiler worker crashed"));
      this.worker?.terminate();
      this.worker = null;
      this.initPromise = null;
    };

    this.worker = worker;
    return worker;
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }

  private request<T extends CompilerWorkerRequestType>(
    type: T,
    payload: CompilerWorkerPayloadMap[T]
  ): Promise<CompilerWorkerSuccessPayloadMap[T]> {
    const worker = this.ensureWorker();
    const id = this.requestId++;
    const request: CompilerWorkerRequest<T> = { id, type, payload };

    return new Promise<CompilerWorkerSuccessPayloadMap[T]>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as CompilerWorkerSuccessPayloadMap[T]),
        reject,
      });
      worker.postMessage(request);
    });
  }

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.request("init", {}).then(() => undefined);
    }
    return this.initPromise;
  }

  async validateNode(
    nodeJson: string,
    globalConfigJson: string
  ): Promise<CompilerWorkerSuccessPayloadMap["validate_node"]["errors"]> {
    const response = await this.request("validate_node", {
      nodeJson,
      globalConfigJson,
    });
    return response.errors;
  }

  async validateWorkflow(
    workflowJson: string
  ): Promise<CompilerWorkerSuccessPayloadMap["validate_workflow"]["errors"]> {
    const response = await this.request("validate_workflow", {
      workflowJson,
    });
    return response.errors;
  }

  async compileWorkflow(
    workflowJson: string
  ): Promise<CompilerWorkerSuccessPayloadMap["compile_workflow"]> {
    return this.request("compile_workflow", {
      workflowJson,
    });
  }
}

let singleton: CompilerWorkerClient | null = null;

export function getCompilerWorkerClient(): CompilerWorkerClient {
  if (!singleton) {
    singleton = new CompilerWorkerClient();
  }
  return singleton;
}
