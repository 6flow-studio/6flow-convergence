//! Topological sort of the workflow graph.
//!
//! When multiple nodes are ready (no unmet dependencies), the topmost node
//! (lowest canvas y) executes first; ties broken by leftmost (lowest x).
//! This matches n8n v1 execution order behavior.

use std::collections::HashMap;

use crate::error::CompilerError;
use crate::parse::graph::WorkflowGraph;
use crate::parse::types::Workflow;

/// Returns node IDs in topological order with position-based sibling ordering.
/// Trigger is always first (it has no incoming edges).
pub fn topo_sort(
    graph: &WorkflowGraph,
    workflow: &Workflow,
) -> Result<Vec<String>, Vec<CompilerError>> {
    // Position lookup: node_id -> (y, x)
    let positions: HashMap<&str, (f64, f64)> = workflow
        .nodes
        .iter()
        .map(|n| (n.id(), (n.position().y, n.position().x)))
        .collect();

    let all_ids: Vec<String> = graph.node_indices.keys().cloned().collect();

    // Kahn's algorithm: compute in-degrees
    let mut in_degree: HashMap<String, usize> =
        all_ids.iter().map(|id| (id.clone(), 0)).collect();
    for node_id in &all_ids {
        for (succ, _) in graph.successors(node_id) {
            *in_degree.entry(succ.to_string()).or_insert(0) += 1;
        }
    }

    // Start with zero-in-degree nodes, sorted by canvas position
    let mut ready: Vec<String> = in_degree
        .iter()
        .filter(|(_, deg)| **deg == 0)
        .map(|(id, _)| id.clone())
        .collect();
    sort_by_position(&mut ready, &positions);

    let mut result = Vec::with_capacity(all_ids.len());

    while !ready.is_empty() {
        let node_id = ready.remove(0);
        result.push(node_id.clone());

        let mut newly_ready = Vec::new();
        for (succ, _) in graph.successors(&node_id) {
            let deg = in_degree.entry(succ.to_string()).or_insert(0);
            *deg = deg.saturating_sub(1);
            if *deg == 0 {
                newly_ready.push(succ.to_string());
            }
        }

        ready.extend(newly_ready);
        sort_by_position(&mut ready, &positions);
    }

    if result.len() != all_ids.len() {
        let cycle_node = in_degree
            .into_iter()
            .find(|(_, deg)| *deg > 0)
            .map(|(id, _)| id)
            .unwrap_or_else(|| "unknown".to_string());
        return Err(vec![CompilerError::lower(
            "L001",
            format!("Cycle detected at node '{cycle_node}'"),
            Some(cycle_node),
        )]);
    }

    Ok(result)
}

fn sort_by_position(ids: &mut Vec<String>, positions: &HashMap<&str, (f64, f64)>) {
    ids.sort_by(|a, b| {
        let (ay, ax) = positions
            .get(a.as_str())
            .copied()
            .unwrap_or((f64::MAX, f64::MAX));
        let (by, bx) = positions
            .get(b.as_str())
            .copied()
            .unwrap_or((f64::MAX, f64::MAX));
        ay.total_cmp(&by).then(ax.total_cmp(&bx))
    });
}
