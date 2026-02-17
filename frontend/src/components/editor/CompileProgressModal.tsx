"use client";

import { AlertTriangle, CheckCircle2, Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompilerActionStatus } from "@/lib/compiler/compiler-types";

interface CompileProgressModalProps {
  open: boolean;
  status: CompilerActionStatus;
  message: string | null;
  downloadUrl: string | null;
  downloadFileName: string | null;
  onClose: () => void;
}

export function CompileProgressModal({
  open,
  status,
  message,
  downloadUrl,
  downloadFileName,
  onClose,
}: CompileProgressModalProps) {
  if (!open) {
    return null;
  }

  const isRunning = status === "running";
  const isSuccess = status === "success";
  const title = isRunning
    ? "Compiling Workflow"
    : isSuccess
      ? "Compile Complete"
      : "Compile Finished";

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center">
      <div className="w-[420px] max-w-[92vw] rounded-xl border border-edge-dim bg-surface-1 shadow-2xl p-5">
        <div className="flex justify-end -mt-1 -mr-1 mb-1">
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-surface-2 text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-colors"
            aria-label="Close compile modal"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent-blue/15 flex items-center justify-center shrink-0">
            {isRunning && <Loader2 size={18} className="animate-spin text-accent-blue" />}
            {isSuccess && <CheckCircle2 size={18} className="text-emerald-400" />}
            {!isRunning && !isSuccess && <AlertTriangle size={18} className="text-amber-400" />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-100">{title}</div>
            <div className="text-xs text-zinc-500 truncate">
              {message ?? "Preparing compiler..."}
            </div>
          </div>
        </div>

        {!isRunning && downloadUrl && downloadFileName && (
          <div className="mt-4 pt-4 border-t border-edge-dim flex items-center justify-end gap-2">
            <Button asChild size="sm" className="h-8 text-xs">
              <a href={downloadUrl} download={downloadFileName}>
                <Download size={13} className="mr-1.5" />
                Download .zip
              </a>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
