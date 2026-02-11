"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNodeComponent } from "./BaseNodeComponent";

export function OutputNode(props: NodeProps) {
  return <BaseNodeComponent {...props} category="output" />;
}
