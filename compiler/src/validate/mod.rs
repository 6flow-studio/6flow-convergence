//! Graph-level validation phase (pre-IR).
//!
//! Validates the raw workflow graph before lowering to IR.

pub mod node_rules;
pub mod structural;

use crate::error::CompilerError;
use crate::parse::graph::WorkflowGraph;
use crate::parse::types::{GlobalConfig, Workflow, WorkflowNode};

/// Validate the entire workflow graph (structural + node configs).
pub fn validate_graph(workflow: &Workflow, graph: &WorkflowGraph) -> Vec<CompilerError> {
    let mut errors = structural::validate_structural(workflow, graph);

    for node in &workflow.nodes {
        errors.extend(validate_node(node, &workflow.global_config));
    }

    errors
}

/// Validate a single node's configuration.
pub fn validate_node(node: &WorkflowNode, global: &GlobalConfig) -> Vec<CompilerError> {
    node_rules::validate_node_config(node, global)
}
