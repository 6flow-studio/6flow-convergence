"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNodeComponent } from "./BaseNodeComponent";

export function TokenizationNode(props: NodeProps) {
  return <BaseNodeComponent {...props} category="tokenization" />;
}
