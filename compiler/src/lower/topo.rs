//! Topological sort of the workflow graph.

use petgraph::algo::toposort;

use crate::error::CompilerError;
use crate::parse::graph::WorkflowGraph;

/// Returns node IDs in topological order. Trigger is always first.
pub fn topo_sort(graph: &WorkflowGraph) -> Result<Vec<String>, Vec<CompilerError>> {
    match toposort(&graph.graph, None) {
        Ok(indices) => {
            let ids: Vec<String> = indices
                .into_iter()
                .map(|idx| graph.graph[idx].clone())
                .collect();
            Ok(ids)
        }
        Err(cycle) => Err(vec![CompilerError::lower(
            "L001",
            format!("Cycle detected at node '{}'", graph.graph[cycle.node_id()]),
            Some(graph.graph[cycle.node_id()].clone()),
        )]),
    }
}
