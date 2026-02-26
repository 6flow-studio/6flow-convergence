//! Graph-level structural validation rules (V001–V010).

use std::collections::HashSet;

use petgraph::algo::is_cyclic_directed;
use petgraph::visit::Bfs;

use crate::error::CompilerError;
use crate::parse::graph::WorkflowGraph;
use crate::parse::types::{Workflow, WorkflowNode};

/// Run all structural validation rules. Returns all errors found.
pub fn validate_structural(workflow: &Workflow, graph: &WorkflowGraph) -> Vec<CompilerError> {
    let mut errors = Vec::new();

    v001_exactly_one_trigger(workflow, &mut errors);
    v002_edges_reference_existing_nodes(workflow, graph, &mut errors);
    v003_no_duplicate_edges(workflow, &mut errors);
    v004_no_cycles(graph, &mut errors);
    v005_all_reachable_from_trigger(workflow, graph, &mut errors);
    v006_trigger_no_incoming(workflow, graph, &mut errors);
    v008_if_has_two_outgoing(workflow, graph, &mut errors);
    v009_merge_has_multiple_incoming(workflow, graph, &mut errors);
    v010_no_self_loops(workflow, graph, &mut errors);

    errors
}

fn v001_exactly_one_trigger(workflow: &Workflow, errors: &mut Vec<CompilerError>) {
    let trigger_count = workflow.nodes.iter().filter(|n| n.is_trigger()).count();
    if trigger_count == 0 {
        errors.push(CompilerError::validate(
            "V001",
            "Workflow must have exactly 1 trigger node, found 0",
            None,
        ));
    } else if trigger_count > 1 {
        errors.push(CompilerError::validate(
            "V001",
            format!(
                "Workflow must have exactly 1 trigger node, found {}",
                trigger_count
            ),
            None,
        ));
    }
}

fn v002_edges_reference_existing_nodes(
    workflow: &Workflow,
    graph: &WorkflowGraph,
    errors: &mut Vec<CompilerError>,
) {
    for edge in &workflow.edges {
        if !graph.node_indices.contains_key(&edge.source) {
            errors.push(CompilerError::validate(
                "V002",
                format!(
                    "Edge '{}' references unknown source node '{}'",
                    edge.id, edge.source
                ),
                None,
            ));
        }
        if !graph.node_indices.contains_key(&edge.target) {
            errors.push(CompilerError::validate(
                "V002",
                format!(
                    "Edge '{}' references unknown target node '{}'",
                    edge.id, edge.target
                ),
                None,
            ));
        }
    }
}

fn v003_no_duplicate_edges(workflow: &Workflow, errors: &mut Vec<CompilerError>) {
    let mut seen = HashSet::new();
    for edge in &workflow.edges {
        let key = (
            edge.source.clone(),
            edge.target.clone(),
            edge.source_handle.clone(),
            edge.target_handle.clone(),
        );
        if !seen.insert(key) {
            errors.push(CompilerError::validate(
                "V003",
                format!("Duplicate edge from '{}' to '{}'", edge.source, edge.target),
                None,
            ));
        }
    }
}

fn v004_no_cycles(graph: &WorkflowGraph, errors: &mut Vec<CompilerError>) {
    if is_cyclic_directed(&graph.graph) {
        errors.push(CompilerError::validate(
            "V004",
            "Workflow graph contains a cycle",
            None,
        ));
    }
}

fn v005_all_reachable_from_trigger(
    workflow: &Workflow,
    graph: &WorkflowGraph,
    errors: &mut Vec<CompilerError>,
) {
    let trigger = workflow.nodes.iter().find(|n| n.is_trigger());
    let Some(trigger) = trigger else { return };

    let Some(&trigger_idx) = graph.node_indices.get(trigger.id()) else {
        return;
    };

    let mut reachable = HashSet::new();
    let mut bfs = Bfs::new(&graph.graph, trigger_idx);
    while let Some(nx) = bfs.next(&graph.graph) {
        reachable.insert(nx);
    }

    for node in &workflow.nodes {
        let Some(&idx) = graph.node_indices.get(node.id()) else {
            continue;
        };
        if !reachable.contains(&idx) {
            errors.push(CompilerError::validate(
                "V005",
                format!("Node '{}' is not reachable from the trigger", node.id()),
                Some(node.id().to_string()),
            ));
        }
    }
}

fn v006_trigger_no_incoming(
    workflow: &Workflow,
    graph: &WorkflowGraph,
    errors: &mut Vec<CompilerError>,
) {
    for node in &workflow.nodes {
        if node.is_trigger() && graph.incoming_count(node.id()) > 0 {
            errors.push(CompilerError::validate(
                "V006",
                format!("Trigger node '{}' must not have incoming edges", node.id()),
                Some(node.id().to_string()),
            ));
        }
    }
}

fn v008_if_has_two_outgoing(
    workflow: &Workflow,
    graph: &WorkflowGraph,
    errors: &mut Vec<CompilerError>,
) {
    for node in &workflow.nodes {
        if let WorkflowNode::If(_) = node {
            let edges = graph.outgoing_edges(node.id());
            if edges.len() != 2 {
                errors.push(CompilerError::validate(
                    "V008",
                    format!(
                        "If node '{}' must have exactly 2 outgoing edges (true/false), found {}",
                        node.id(),
                        edges.len()
                    ),
                    Some(node.id().to_string()),
                ));
                continue;
            }

            let handles: HashSet<Option<&str>> = edges
                .iter()
                .map(|(_, e)| e.source_handle.as_deref())
                .collect();
            if !handles.contains(&Some("true")) || !handles.contains(&Some("false")) {
                errors.push(CompilerError::validate(
                    "V008",
                    format!(
                        "If node '{}' outgoing edges must have sourceHandle 'true' and 'false'",
                        node.id()
                    ),
                    Some(node.id().to_string()),
                ));
            }
        }
    }
}

fn v009_merge_has_multiple_incoming(
    workflow: &Workflow,
    graph: &WorkflowGraph,
    errors: &mut Vec<CompilerError>,
) {
    for node in &workflow.nodes {
        if let WorkflowNode::Merge(_) = node {
            let count = graph.incoming_count(node.id());
            if count < 2 {
                errors.push(CompilerError::validate(
                    "V009",
                    format!(
                        "Merge node '{}' must have at least 2 incoming edges, found {}",
                        node.id(),
                        count
                    ),
                    Some(node.id().to_string()),
                ));
            }
        }
    }
}

fn v010_no_self_loops(workflow: &Workflow, graph: &WorkflowGraph, errors: &mut Vec<CompilerError>) {
    for edge in &workflow.edges {
        if edge.source == edge.target {
            errors.push(CompilerError::validate(
                "V010",
                format!("Self-loop detected on node '{}'", edge.source),
                Some(edge.source.clone()),
            ));
        }
    }
    // Also check petgraph for any self-loops
    let _ = graph; // Already checked via edge iteration above
}
