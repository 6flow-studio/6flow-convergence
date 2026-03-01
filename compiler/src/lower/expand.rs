//! Convenience node expansion: sugar nodes → primitive CRE steps.
//!
//! Expansion happens BEFORE step building. Each convenience node becomes
//! multiple primitive nodes using the `{nodeId}___sub` ID convention.
//! SYNC NOTE: Convenience-node mappings here must track node types/configs in
//! `shared/model/node.ts` and `compiler/src/parse/types.rs`.

use std::collections::HashMap;

use crate::ir::types::*;
use crate::parse::types::*;

/// An expanded step ready for the builder.
pub struct ExpandedStep {
    pub id: String,
    pub source_node_id: String,
    pub label: String,
    pub operation: Operation,
    pub output: Option<OutputBinding>,
}

/// Expand a convenience node into primitive steps.
/// Returns None if the node is not a convenience node.
pub fn expand_node(
    _node: &WorkflowNode,
    _id_map: &HashMap<String, String>,
) -> Option<Vec<ExpandedStep>> {
    // No convenience nodes are currently defined.
    None
}

/// Returns the "output" step ID for a convenience node (the last expanded step).
/// This is used so downstream references resolve to the right step.
pub fn output_step_id(_node: &WorkflowNode) -> Option<String> {
    // No convenience nodes are currently defined.
    None
}
