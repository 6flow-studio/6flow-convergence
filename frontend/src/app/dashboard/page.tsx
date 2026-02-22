"use client";

import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import Image from "next/image";
import { Plus, Trash2, LogOut, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_WORKFLOW_GLOBAL_CONFIG } from "@/lib/workflow-defaults";
import type { Id } from "../../../convex/_generated/dataModel";

export default function DashboardPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const workflows = useQuery(api.workflows.list);
  const saveWorkflow = useMutation(api.workflows.save);
  const removeWorkflow = useMutation(api.workflows.remove);
  const { signOut } = useAuthActions();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  async function handleNewWorkflow() {
    const id = await saveWorkflow({
      name: "Untitled Workflow",
      nodes: "[]",
      edges: "[]",
      globalConfig: JSON.stringify(DEFAULT_WORKFLOW_GLOBAL_CONFIG),
    });
    router.push(`/editor/${id}`);
  }

  async function handleDelete(id: Id<"workflows">) {
    await removeWorkflow({ id });
  }

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Header */}
      <div className="h-14 bg-surface-1 border-b border-edge-dim flex items-center px-6 justify-between">
        <div className="flex items-center gap-2.5">
          <Image src="/logo/6flow_white.png" alt="6FLOW" width={28} height={28} />
          <span className="text-[13px] font-bold text-zinc-100 tracking-tight">
            6FLOW Studio
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:text-zinc-200 text-xs"
          onClick={() => void signOut()}
        >
          <LogOut size={14} className="mr-1.5" />
          Sign out
        </Button>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-zinc-100">Workflows</h1>
          <Button
            size="sm"
            className="bg-accent-blue hover:bg-blue-500 text-white h-8 px-4 text-xs font-semibold"
            onClick={() => void handleNewWorkflow()}
          >
            <Plus size={14} className="mr-1.5" />
            New Workflow
          </Button>
        </div>

        {workflows === undefined ? (
          <div className="text-zinc-500 text-sm">Loading...</div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <Workflow size={48} className="mb-4 opacity-30" />
            <p className="text-sm">No workflows yet. Create your first one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((wf) => {
              const nodeCount = JSON.parse(wf.nodes).length;
              return (
                <div
                  key={wf._id}
                  className="group bg-surface-1 border border-edge-dim rounded-lg p-4 hover:border-edge-bright transition-colors cursor-pointer"
                  onClick={() => router.push(`/editor/${wf._id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-zinc-200 truncate">
                        {wf.name}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        {nodeCount} node{nodeCount !== 1 ? "s" : ""} &middot;{" "}
                        {new Date(wf.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(wf._id);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
