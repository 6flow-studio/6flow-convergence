"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Plus, RotateCcw, Trash2 } from "lucide-react";
import type {
  GlobalConfig,
  RpcEntry,
  SecretReference,
} from "@6flow/shared/model/node";
import { SUPPORTED_CHAINS } from "@6flow/shared/supportedChain";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FieldLabel,
  SelectField,
} from "@/components/editor/config-fields";

interface WorkflowSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: GlobalConfig;
  onSave: (value: GlobalConfig) => void;
}

function cloneSecrets(secrets: SecretReference[]): SecretReference[] {
  return secrets.map((secret) => ({
    name: secret.name,
    envVariable: secret.envVariable,
  }));
}

function cloneRpcs(rpcs: RpcEntry[]): RpcEntry[] {
  return rpcs.map((rpc) => ({
    chainName: rpc.chainName,
    url: rpc.url,
  }));
}

function getFilteredChains(isTestnet: boolean) {
  return SUPPORTED_CHAINS.filter((chain) => chain.isTestnet === isTestnet);
}

function getDefaultUrl(chainSelectorName: string): string {
  return (
    SUPPORTED_CHAINS.find((c) => c.chainSelectorName === chainSelectorName)
      ?.defaultRPCUrl ?? ""
  );
}

function getEffectiveUrl(chainSelectorName: string, rpcs: RpcEntry[]): string {
  const override = rpcs.find((r) => r.chainName === chainSelectorName);
  return override?.url ?? getDefaultUrl(chainSelectorName);
}

export function WorkflowSettingsSheet({
  open,
  onOpenChange,
  value,
  onSave,
}: WorkflowSettingsSheetProps) {
  const [draft, setDraft] = useState<GlobalConfig>(value);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft({
      isTestnet: value.isTestnet,
      secrets: cloneSecrets(value.secrets),
      rpcs: cloneRpcs(value.rpcs),
    });
  }, [open, value]);

  function updateSecret(
    index: number,
    key: keyof SecretReference,
    fieldValue: string
  ) {
    setDraft((previous) => {
      const nextSecrets = [...previous.secrets];
      nextSecrets[index] = {
        ...nextSecrets[index],
        [key]: fieldValue,
      };
      return {
        ...previous,
        secrets: nextSecrets,
      };
    });
  }

  function addSecret() {
    setDraft((previous) => ({
      ...previous,
      secrets: [...previous.secrets, { name: "", envVariable: "" }],
    }));
  }

  function removeSecret(index: number) {
    setDraft((previous) => ({
      ...previous,
      secrets: previous.secrets.filter((_, current) => current !== index),
    }));
  }

  function updateRpcUrl(chainSelectorName: string, url: string) {
    setDraft((previous) => {
      const exists = previous.rpcs.some(
        (r) => r.chainName === chainSelectorName
      );
      const nextRpcs = exists
        ? previous.rpcs.map((r) =>
            r.chainName === chainSelectorName ? { ...r, url } : r
          )
        : [...previous.rpcs, { chainName: chainSelectorName, url }];
      return { ...previous, rpcs: nextRpcs };
    });
  }

  function resetRpcUrl(chainSelectorName: string) {
    setDraft((previous) => ({
      ...previous,
      rpcs: previous.rpcs.filter((r) => r.chainName !== chainSelectorName),
    }));
  }

  const filteredChains = getFilteredChains(draft.isTestnet);

  const secretNameConflicts = draft.secrets.map(
    (secret) =>
      secret.name.trim().length > 0 &&
      secret.envVariable.trim().length > 0 &&
      secret.name.trim() === secret.envVariable.trim()
  );
  const hasSecretConflicts = secretNameConflicts.some(Boolean);

  function handleSave() {
    const normalizedSecrets = draft.secrets
      .map((secret) => ({
        name: secret.name.trim(),
        envVariable: secret.envVariable.trim(),
      }))
      .filter((secret) => secret.name.length > 0 && secret.envVariable.length > 0);

    const normalizedRpcs = draft.rpcs
      .map((rpc) => ({ chainName: rpc.chainName, url: rpc.url.trim() }))
      .filter(
        (rpc) =>
          rpc.url.length > 0 && rpc.url !== getDefaultUrl(rpc.chainName)
      );

    onSave({
      isTestnet: draft.isTestnet,
      secrets: normalizedSecrets,
      rpcs: normalizedRpcs,
    });

    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-surface-1 border-edge-dim p-0 w-[420px] sm:max-w-[420px]"
      >
        <SheetHeader className="px-4 py-3 border-b border-edge-dim gap-1">
          <SheetTitle className="text-zinc-200 text-sm">Workflow Settings</SheetTitle>
          <SheetDescription className="text-zinc-500 text-xs">
            Configure workflow-level compiler inputs.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 py-4 space-y-4 overflow-auto">
          <SelectField
            label="Environment"
            description="Target environment for the generated compiler config"
            value={draft.isTestnet ? "testnet" : "production"}
            onChange={(value) =>
              setDraft((previous) => ({ ...previous, isTestnet: value === "testnet" }))
            }
            options={[
              { value: "testnet", label: "Testnet" },
              { value: "production", label: "Production" },
            ]}
          />

          <div className="space-y-2">
            <FieldLabel
              label="Secrets"
              description="Used in secrets.yaml as a key value to map between your CRE workflow and env key"
            />
            <div className="space-y-2">
              {draft.secrets.map((secret, index) => (
                <div key={`secret-${index}`} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={secret.name}
                      onChange={(event) =>
                        updateSecret(index, "name", event.target.value)
                      }
                      placeholder="Secret name"
                      className={`h-8 bg-surface-2 text-zinc-300 text-[12px] ${secretNameConflicts[index] ? "border-amber-500/60" : "border-edge-dim"}`}
                    />
                    <Input
                      value={secret.envVariable}
                      onChange={(event) =>
                        updateSecret(index, "envVariable", event.target.value)
                      }
                      placeholder="Env variable"
                      className={`h-8 bg-surface-2 text-zinc-300 text-[12px] ${secretNameConflicts[index] ? "border-amber-500/60" : "border-edge-dim"}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-500 hover:text-red-400"
                      onClick={() => removeSecret(index)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                  {secretNameConflicts[index] && (
                    <div className="flex items-center gap-1.5 text-amber-400 text-[11px] pl-0.5">
                      <AlertTriangle size={11} />
                      Secret name and env variable must be different — CRE does not allow identical values.
                    </div>
                  )}
                </div>
              ))}

              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-zinc-400 hover:text-zinc-200"
                onClick={addSecret}
              >
                <Plus size={12} className="mr-1.5" />
                Add Secret
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel
              label="RPC URLs"
              description="Override default public RPC endpoints per chain"
            />
            <div className="space-y-2">
              {filteredChains.map((chain) => {
                const effectiveUrl = getEffectiveUrl(
                  chain.chainSelectorName,
                  draft.rpcs
                );
                const isOverridden = effectiveUrl !== chain.defaultRPCUrl;
                return (
                  <div
                    key={chain.chainSelectorName}
                    className="space-y-1"
                  >
                    <span className="text-[11px] text-zinc-400">
                      {chain.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={effectiveUrl}
                        onChange={(event) =>
                          updateRpcUrl(
                            chain.chainSelectorName,
                            event.target.value
                          )
                        }
                        placeholder={chain.defaultRPCUrl}
                        className={`h-8 bg-surface-2 text-zinc-300 text-[12px] font-mono border-edge-dim ${isOverridden ? "border-accent-blue/40" : ""}`}
                      />
                      {isOverridden && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-zinc-500 hover:text-zinc-200"
                          onClick={() =>
                            resetRpcUrl(chain.chainSelectorName)
                          }
                          title="Reset to default"
                        >
                          <RotateCcw size={12} />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <SheetFooter className="border-t border-edge-dim px-4 py-3 flex-row justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-accent-blue hover:bg-blue-500"
            onClick={handleSave}
            disabled={hasSecretConflicts}
          >
            Save Settings
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
