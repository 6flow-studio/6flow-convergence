"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNodeComponent } from "./BaseNodeComponent";

export function TransformNode(props: NodeProps) {
  return <BaseNodeComponent {...props} category="transform" />;
}
