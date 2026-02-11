"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNodeComponent } from "./BaseNodeComponent";

export function TriggerNode(props: NodeProps) {
  return <BaseNodeComponent {...props} category="trigger" />;
}
