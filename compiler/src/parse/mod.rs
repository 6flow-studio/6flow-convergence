//! Parse phase: JSON → Rust types + graph construction.

pub mod graph;
pub mod types;

pub use graph::WorkflowGraph;
pub use types::*;

use crate::error::CompilerError;

/// Deserialize a workflow JSON string into a `Workflow` struct.
pub fn parse(json: &str) -> Result<Workflow, Vec<CompilerError>> {
    serde_json::from_str::<Workflow>(json).map_err(|e| {
        vec![CompilerError::parse(
            "P001",
            format!("Failed to parse workflow JSON: {}", e),
        )]
    })
}

/// Parse JSON and build the graph in one step.
pub fn parse_and_build(json: &str) -> Result<(Workflow, WorkflowGraph), Vec<CompilerError>> {
    let workflow = parse(json)?;
    let graph = WorkflowGraph::build(&workflow)?;
    Ok((workflow, graph))
}
