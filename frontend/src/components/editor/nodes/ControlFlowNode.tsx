"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNodeComponent } from "./BaseNodeComponent";

export function ControlFlowNode(props: NodeProps) {
  return <BaseNodeComponent {...props} category="controlFlow" />;
}
