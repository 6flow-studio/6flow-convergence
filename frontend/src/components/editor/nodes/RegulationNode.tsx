"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNodeComponent } from "./BaseNodeComponent";

export function RegulationNode(props: NodeProps) {
  return <BaseNodeComponent {...props} category="regulation" />;
}
