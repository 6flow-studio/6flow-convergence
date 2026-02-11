"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNodeComponent } from "./BaseNodeComponent";

export function AINode(props: NodeProps) {
  return <BaseNodeComponent {...props} category="ai" />;
}
