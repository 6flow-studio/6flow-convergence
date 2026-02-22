import type { NodeCategory } from "@/lib/node-registry";

export const CATEGORY_NODE_STYLES: Record<
  NodeCategory,
  {
    bg: string;
    border: string;
    headerBg: string;
    headerText: string;
    bodyText: string;
    glow: string;
  }
> = {
  trigger: {
    bg: "bg-[#1a0f0f]",
    border: "border-red-500/30",
    headerBg: "bg-gradient-to-r from-red-600 to-red-500",
    headerText: "text-white",
    bodyText: "text-red-300/70",
    glow: "shadow-red-500/10",
  },
  action: {
    bg: "bg-[#0f1320]",
    border: "border-blue-500/30",
    headerBg: "bg-gradient-to-r from-blue-600 to-blue-500",
    headerText: "text-white",
    bodyText: "text-blue-300/70",
    glow: "shadow-blue-500/10",
  },
  transform: {
    bg: "bg-[#160f20]",
    border: "border-purple-500/30",
    headerBg: "bg-gradient-to-r from-purple-600 to-purple-500",
    headerText: "text-white",
    bodyText: "text-purple-300/70",
    glow: "shadow-purple-500/10",
  },
  controlFlow: {
    bg: "bg-[#1a1408]",
    border: "border-orange-500/30",
    headerBg: "bg-gradient-to-r from-orange-600 to-amber-500",
    headerText: "text-white",
    bodyText: "text-orange-300/70",
    glow: "shadow-orange-500/10",
  },
  ai: {
    bg: "bg-[#0a1a10]",
    border: "border-emerald-500/30",
    headerBg: "bg-gradient-to-r from-emerald-600 to-green-500",
    headerText: "text-white",
    bodyText: "text-emerald-300/70",
    glow: "shadow-emerald-500/10",
  },
  output: {
    bg: "bg-[#141416]",
    border: "border-zinc-600/30",
    headerBg: "bg-gradient-to-r from-zinc-600 to-zinc-500",
    headerText: "text-white",
    bodyText: "text-zinc-400/70",
    glow: "shadow-zinc-500/10",
  },
  tokenization: {
    bg: "bg-[#1a1708]",
    border: "border-amber-500/30",
    headerBg: "bg-gradient-to-r from-amber-600 to-yellow-500",
    headerText: "text-black",
    bodyText: "text-amber-300/70",
    glow: "shadow-amber-500/10",
  },
  regulation: {
    bg: "bg-[#081a18]",
    border: "border-teal-500/30",
    headerBg: "bg-gradient-to-r from-teal-600 to-teal-500",
    headerText: "text-white",
    bodyText: "text-teal-300/70",
    glow: "shadow-teal-500/10",
  },
};

export const HANDLE_STYLE = {
  width: 9,
  height: 9,
  borderRadius: "50%",
  background: "#52525b",
  border: "2px solid #18181b",
  transition: "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease",
};

export const HANDLE_STYLE_CONNECTED = {
  ...HANDLE_STYLE,
  background: "#3A9AFF",
  border: "2px solid #1C0770",
};
