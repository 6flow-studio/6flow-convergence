"use client";

import { createContext, useContext, useCallback, useRef } from "react";
import type { UpstreamNodeInfo } from "./upstream-resolver";

/**
 * A target field that can receive expression insertions.
 */
export interface ExpressionInsertTarget {
  /** Insert text at the cursor position */
  insertAtCursor: (text: string) => void;
}

interface ExpressionInsertContextValue {
  /** Register a field as the active insertion target (call on focus) */
  registerTarget: (target: ExpressionInsertTarget) => void;
  /** Clear the active target (call on blur, with delay to allow click-to-insert) */
  clearTarget: () => void;
  /** Insert a reference into the active target, or copy to clipboard as fallback */
  insertReference: (ref: string) => void;
  /** Upstream nodes available for autocomplete */
  upstreamNodes: UpstreamNodeInfo[];
}

const ExpressionInsertCtx = createContext<ExpressionInsertContextValue | null>(null);

export function ExpressionInsertProvider({
  children,
  upstreamNodes,
}: {
  children: React.ReactNode;
  upstreamNodes: UpstreamNodeInfo[];
}) {
  const activeTarget = useRef<ExpressionInsertTarget | null>(null);

  const registerTarget = useCallback((target: ExpressionInsertTarget) => {
    activeTarget.current = target;
  }, []);

  const clearTarget = useCallback(() => {
    // Delay to allow click-to-insert to fire before target is cleared
    setTimeout(() => {
      activeTarget.current = null;
    }, 200);
  }, []);

  const insertReference = useCallback((ref: string) => {
    if (activeTarget.current) {
      activeTarget.current.insertAtCursor(ref);
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(ref);
    }
  }, []);

  return (
    <ExpressionInsertCtx.Provider
      value={{ registerTarget, clearTarget, insertReference, upstreamNodes }}
    >
      {children}
    </ExpressionInsertCtx.Provider>
  );
}

export function useExpressionInsert() {
  return useContext(ExpressionInsertCtx);
}
