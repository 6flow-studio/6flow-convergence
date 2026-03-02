import { useState, useCallback, type DragEvent } from "react";
import {
  FIELD_REF_MIME,
  decodeFieldRef,
  buildExpression,
  type FieldRefDragData,
} from "@/lib/drag-field-ref";

interface UseFieldDropOptions {
  value: string;
  onChange: (value: string) => void;
  mode?: "insert" | "replace";
}

interface UseFieldDropResult {
  isDragOver: boolean;
  fieldRef: FieldRefDragData | null;
  dropProps: {
    onDragOver: (e: DragEvent) => void;
    onDragLeave: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
  };
}

export function useFieldDrop({
  value,
  onChange,
  mode = "insert",
}: UseFieldDropOptions): UseFieldDropResult {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fieldRef, setFieldRef] = useState<FieldRefDragData | null>(null);

  const onDragOver = useCallback((e: DragEvent) => {
    if (!e.dataTransfer.types.includes(FIELD_REF_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent) => {
    // Only leave when actually exiting the element, not entering a child
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const raw = e.dataTransfer.getData(FIELD_REF_MIME);
      const data = decodeFieldRef(raw);
      if (!data) return;

      setFieldRef(data);
      const expression = buildExpression(data);

      if (mode === "replace") {
        onChange(expression);
        return;
      }

      // Insert mode: try to insert at cursor position
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (target && typeof target.selectionStart === "number") {
        const start = target.selectionStart;
        const before = value.slice(0, start);
        const after = value.slice(start);
        onChange(before + expression + after);
      } else {
        // Fallback: append
        onChange(value + expression);
      }
    },
    [value, onChange, mode]
  );

  return {
    isDragOver,
    fieldRef,
    dropProps: { onDragOver, onDragLeave, onDrop },
  };
}
