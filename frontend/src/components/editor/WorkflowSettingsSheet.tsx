"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { GlobalConfig, SecretReference } from "@6flow/shared/model/node";
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
  BooleanField,
  ChainSelectorField,
  FieldLabel,
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
      defaultChainSelector: value.defaultChainSelector,
      secrets: cloneSecrets(value.secrets),
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

  function handleSave() {
    const normalizedSecrets = draft.secrets
      .map((secret) => ({
        name: secret.name.trim(),
        envVariable: secret.envVariable.trim(),
      }))
      .filter((secret) => secret.name.length > 0 && secret.envVariable.length > 0);

    onSave({
      isTestnet: draft.isTestnet,
      defaultChainSelector: draft.defaultChainSelector,
      secrets: normalizedSecrets,
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
          <BooleanField
            label="Testnet"
            description="Toggle whether generated config assumes testnet environment"
            value={draft.isTestnet}
            onChange={(value) => setDraft((previous) => ({ ...previous, isTestnet: value }))}
          />

          <ChainSelectorField
            label="Default Chain"
            description="Fallback chain selector for nodes that rely on global defaults"
            value={draft.defaultChainSelector}
            onChange={(value) =>
              setDraft((previous) => ({
                ...previous,
                defaultChainSelector: value,
              }))
            }
          />

          <div className="space-y-2">
            <FieldLabel
              label="Secrets"
              description="Secrets used by compiler validation and generated secrets.yaml"
            />
            <div className="space-y-2">
              {draft.secrets.length === 0 && (
                <div className="text-[11px] text-zinc-600 border border-edge-dim rounded-md px-2.5 py-2">
                  No secrets configured.
                </div>
              )}

              {draft.secrets.map((secret, index) => (
                <div key={`secret-${index}`} className="flex items-center gap-2">
                  <Input
                    value={secret.name}
                    onChange={(event) =>
                      updateSecret(index, "name", event.target.value)
                    }
                    placeholder="Secret name"
                    className="h-8 bg-surface-2 border-edge-dim text-zinc-300 text-[12px]"
                  />
                  <Input
                    value={secret.envVariable}
                    onChange={(event) =>
                      updateSecret(index, "envVariable", event.target.value)
                    }
                    placeholder="Env variable"
                    className="h-8 bg-surface-2 border-edge-dim text-zinc-300 text-[12px]"
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
          >
            Save Settings
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
