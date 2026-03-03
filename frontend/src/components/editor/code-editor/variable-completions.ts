import type { CompletionSource } from "@codemirror/autocomplete";

export interface VariableCompletionEntry {
  label: string; // text inserted on completion
  detail: string; // type shown next to the completion label
}

/**
 * Returns a CodeMirror CompletionSource that suggests the given variables.
 * Accepts a getter so the source always reads the latest variables without
 * requiring the editor to be re-created.
 */
export function buildVariableCompletions(
  getVars: () => VariableCompletionEntry[],
): CompletionSource {
  return (context) => {
    const word = context.matchBefore(/\w[\w.]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    return {
      from: word.from,
      options: getVars().map((v) => ({
        label: v.label,
        detail: v.detail,
        type: "variable",
      })),
    };
  };
}
