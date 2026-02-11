import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export const editorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "rgb(24, 24, 27)", // surface-2
      color: "#d4d4d8", // zinc-300
      fontSize: "13px",
      height: "100%",
    },
    ".cm-content": {
      caretColor: "#60a5fa", // accent-blue
      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
      padding: "8px 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#60a5fa",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "rgba(96, 165, 250, 0.2)",
      },
    ".cm-gutters": {
      backgroundColor: "rgb(24, 24, 27)",
      color: "#52525b", // zinc-600
      border: "none",
      paddingRight: "8px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "#a1a1aa", // zinc-400
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    ".cm-line": {
      padding: "0 12px",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-matchingBracket": {
      backgroundColor: "rgba(96, 165, 250, 0.15)",
      color: "#e4e4e7 !important",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(234, 179, 8, 0.2)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(234, 179, 8, 0.4)",
    },
    ".cm-tooltip": {
      backgroundColor: "rgb(39, 39, 42)", // surface-3
      border: "1px solid rgb(63, 63, 70)", // zinc-700
      color: "#d4d4d8",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li": {
        padding: "2px 8px",
      },
      "& > ul > li[aria-selected]": {
        backgroundColor: "rgba(96, 165, 250, 0.15)",
        color: "#e4e4e7",
      },
    },
  },
  { dark: true }
);

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#c084fc" }, // purple-400
  { tag: tags.string, color: "#86efac" }, // green-300
  { tag: tags.number, color: "#fdba74" }, // orange-300
  { tag: tags.bool, color: "#fdba74" },
  { tag: tags.null, color: "#fdba74" },
  { tag: tags.comment, color: "#52525b", fontStyle: "italic" },
  { tag: tags.function(tags.variableName), color: "#60a5fa" }, // blue-400
  { tag: tags.typeName, color: "#67e8f9" }, // cyan-300
  { tag: tags.className, color: "#67e8f9" },
  { tag: tags.definition(tags.variableName), color: "#e4e4e7" },
  { tag: tags.variableName, color: "#d4d4d8" },
  { tag: tags.propertyName, color: "#93c5fd" }, // blue-300
  { tag: tags.operator, color: "#a1a1aa" },
  { tag: tags.punctuation, color: "#71717a" },
  { tag: tags.bracket, color: "#a1a1aa" },
  { tag: tags.tagName, color: "#f87171" }, // red-400
  { tag: tags.attributeName, color: "#fbbf24" }, // amber-400
  { tag: tags.regexp, color: "#f87171" },
]);

export const editorHighlighting = syntaxHighlighting(highlightStyle);
