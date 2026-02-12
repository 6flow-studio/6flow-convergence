//! petgraph-based directed graph wrapper for the visual workflow.

use std::collections::HashMap;

use petgraph::graph::{DiGraph, NodeIndex};

use super::types::Workflow;
use crate::error::CompilerError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EdgeLabel {
    pub source_handle: Option<String>,
    pub target_handle: Option<String>,
}

pub struct WorkflowGraph {
    pub graph: DiGraph<String, EdgeLabel>,
    pub node_indices: HashMap<String, NodeIndex>,
}

impl WorkflowGraph {
    pub fn build(workflow: &Workflow) -> Result<Self, Vec<CompilerError>> {
        let mut graph = DiGraph::new();
        let mut node_indices = HashMap::new();
        let mut errors = Vec::new();

        // Add all nodes
        for node in &workflow.nodes {
            let id = node.id().to_string();
            let idx = graph.add_node(id.clone());
            node_indices.insert(id, idx);
        }

        // Add all edges
        for edge in &workflow.edges {
            let source_idx = node_indices.get(&edge.source);
            let target_idx = node_indices.get(&edge.target);

            match (source_idx, target_idx) {
                (Some(&s), Some(&t)) => {
                    graph.add_edge(
                        s,
                        t,
                        EdgeLabel {
                            source_handle: edge.source_handle.clone(),
                            target_handle: edge.target_handle.clone(),
                        },
                    );
                }
                (None, _) => {
                    errors.push(CompilerError::parse(
                        "P002",
                        format!("Edge '{}' references unknown source node '{}'", edge.id, edge.source),
                    ));
                }
                (_, None) => {
                    errors.push(CompilerError::parse(
                        "P002",
                        format!("Edge '{}' references unknown target node '{}'", edge.id, edge.target),
                    ));
                }
            }
        }

        if !errors.is_empty() {
            return Err(errors);
        }

        Ok(WorkflowGraph { graph, node_indices })
    }

    pub fn successors(&self, node_id: &str) -> Vec<(&str, &EdgeLabel)> {
        let Some(&idx) = self.node_indices.get(node_id) else {
            return vec![];
        };
        self.graph
            .neighbors_directed(idx, petgraph::Direction::Outgoing)
            .map(|n| {
                let edge_idx = self.graph.find_edge(idx, n).unwrap();
                let label = &self.graph[edge_idx];
                (self.graph[n].as_str(), label)
            })
            .collect()
    }

    pub fn predecessors(&self, node_id: &str) -> Vec<&str> {
        let Some(&idx) = self.node_indices.get(node_id) else {
            return vec![];
        };
        self.graph
            .neighbors_directed(idx, petgraph::Direction::Incoming)
            .map(|n| self.graph[n].as_str())
            .collect()
    }

    pub fn outgoing_edges(&self, node_id: &str) -> Vec<(&str, &EdgeLabel)> {
        self.successors(node_id)
    }

    pub fn incoming_count(&self, node_id: &str) -> usize {
        self.predecessors(node_id).len()
    }

    pub fn outgoing_count(&self, node_id: &str) -> usize {
        self.successors(node_id).len()
    }

}
