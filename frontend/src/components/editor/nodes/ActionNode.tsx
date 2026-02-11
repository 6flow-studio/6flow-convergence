"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNodeComponent } from "./BaseNodeComponent";

export function ActionNode(props: NodeProps) {
  return <BaseNodeComponent {...props} category="action" />;
}
