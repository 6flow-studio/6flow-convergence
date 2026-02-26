"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "./FieldLabel";
import { useExpressionInsert } from "@/lib/expression-insert-context";
import { NODE_TYPE_TO_CATEGORY } from "@6flow/shared/model/node";
import { CATEGORY_COLORS } from "@/lib/node-registry";

interface ExpressionTextFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
}

interface AutocompleteItem {
  nodeId: string;
  nodeLabel: string;
  fieldName: string;
  fieldType: string;
  /** Full reference string e.g. "{{nodeId.fieldName}}" */
  reference: string;
  color: string;
}

export function ExpressionTextField({
  label,
  description,
  value,
  onChange,
  placeholder,
  mono,
}: ExpressionTextFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const expressionInsert = useExpressionInsert();
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteFilter, setAutocompleteFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Track the position of {{ in the input for replacement
  const bracketStartRef = useRef<number>(-1);

  const hasExpression = value.includes("{{");

  // Build autocomplete items from upstream nodes
  const allItems: AutocompleteItem[] = [];
  if (expressionInsert) {
    for (const upstream of expressionInsert.upstreamNodes) {
      const category = NODE_TYPE_TO_CATEGORY[upstream.nodeType];
      const color = CATEGORY_COLORS[category];
      for (const field of upstream.fields) {
        allItems.push({
          nodeId: upstream.nodeId,
          nodeLabel: upstream.nodeLabel,
          fieldName: field.name,
          fieldType: field.type,
          reference: `{{${upstream.nodeId}.${field.name}}}`,
          color,
        });
      }
    }
  }

  const filteredItems = autocompleteFilter
    ? allItems.filter(
        (item) =>
          item.fieldName.toLowerCase().includes(autocompleteFilter.toLowerCase()) ||
          item.nodeLabel.toLowerCase().includes(autocompleteFilter.toLowerCase()) ||
          item.nodeId.toLowerCase().includes(autocompleteFilter.toLowerCase()),
      )
    : allItems;

  // Register with expression insert context
  useEffect(() => {
    if (!expressionInsert || !inputRef.current) return;

    const target = {
      insertAtCursor: (text: string) => {
        const el = inputRef.current;
        if (!el) {
          onChange(value + text);
          return;
        }
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const newValue = value.slice(0, start) + text + value.slice(end);
        onChange(newValue);
        // Set cursor after inserted text
        requestAnimationFrame(() => {
          el.setSelectionRange(start + text.length, start + text.length);
          el.focus();
        });
      },
    };

    const el = inputRef.current;

    const handleFocus = () => expressionInsert.registerTarget(target);
    const handleBlur = () => expressionInsert.clearTarget();

    el.addEventListener("focus", handleFocus);
    el.addEventListener("blur", handleBlur);

    return () => {
      el.removeEventListener("focus", handleFocus);
      el.removeEventListener("blur", handleBlur);
    };
  }, [expressionInsert, value, onChange]);

  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue);

      // Detect {{ for autocomplete
      const el = inputRef.current;
      if (!el) return;

      const cursorPos = el.selectionStart ?? newValue.length;
      const textBeforeCursor = newValue.slice(0, cursorPos);

      // Find last {{ that hasn't been closed
      const lastOpen = textBeforeCursor.lastIndexOf("{{");
      if (lastOpen !== -1) {
        const afterOpen = textBeforeCursor.slice(lastOpen + 2);
        // Only show if there's no }} after the {{
        if (!afterOpen.includes("}}")) {
          bracketStartRef.current = lastOpen;
          setAutocompleteFilter(afterOpen);
          setShowAutocomplete(true);
          setSelectedIndex(0);
          return;
        }
      }

      setShowAutocomplete(false);
    },
    [onChange],
  );

  const selectItem = useCallback(
    (item: AutocompleteItem) => {
      const start = bracketStartRef.current;
      if (start === -1) return;

      // Replace from {{ to cursor with the full reference
      const el = inputRef.current;
      const cursorPos = el?.selectionStart ?? value.length;
      const newValue = value.slice(0, start) + item.reference + value.slice(cursorPos);
      onChange(newValue);
      setShowAutocomplete(false);

      // Restore focus after selection
      requestAnimationFrame(() => {
        if (el) {
          const newCursorPos = start + item.reference.length;
          el.setSelectionRange(newCursorPos, newCursorPos);
          el.focus();
        }
      });
    },
    [value, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showAutocomplete || filteredItems.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectItem(filteredItems[selectedIndex]);
      } else if (e.key === "Escape") {
        setShowAutocomplete(false);
      }
    },
    [showAutocomplete, filteredItems, selectedIndex, selectItem],
  );

  // Close autocomplete when clicking outside
  useEffect(() => {
    if (!showAutocomplete) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAutocomplete]);

  return (
    <div ref={containerRef} className="relative">
      <FieldLabel label={label} description={description} />
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`h-8 bg-surface-2 border-edge-dim text-zinc-300 text-[12px] hover:border-edge-bright focus:border-accent-blue transition-colors pr-8 ${mono ? "font-mono" : ""}`}
        />
        {/* Expression indicator */}
        {hasExpression && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-accent-blue/60 pointer-events-none select-none">
            {"{{ }}"}
          </div>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {showAutocomplete && filteredItems.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface-2 border border-edge-dim rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filteredItems.map((item, index) => (
            <button
              key={item.reference}
              type="button"
              className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-left transition-colors ${
                index === selectedIndex
                  ? "bg-accent-blue/10 text-zinc-200"
                  : "text-zinc-400 hover:bg-surface-3"
              }`}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                selectItem(item);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[11px] font-mono text-zinc-300 truncate">
                {item.fieldName}
              </span>
              <span className="text-[10px] text-zinc-600">{item.fieldType}</span>
              <span className="text-[10px] text-zinc-600 ml-auto truncate max-w-[80px]">
                {item.nodeLabel}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
