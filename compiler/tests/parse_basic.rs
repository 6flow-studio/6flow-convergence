//! Integration tests for the Parse phase: workflow JSON parsing, round-trips, graph building.
//! SYNC NOTE: Update node-type assertions/fixtures here when changing
//! `shared/model/node.ts` or `compiler/src/parse/types.rs`.

use compiler::parse;

#[test]
fn parse_example_workflow() {
    let json = include_str!("fixtures/example_workflow.json");
    let workflow = parse::parse(json).expect("Should parse successfully");
    assert_eq!(workflow.id, "example-tokenization-workflow");
    assert_eq!(workflow.name, "KYC-Gated Token Minting");
    assert_eq!(workflow.nodes.len(), 6);
    assert_eq!(workflow.edges.len(), 5);
    assert!(workflow.global_config.is_testnet);
}

#[test]
fn parse_round_trip() {
    let json = include_str!("fixtures/example_workflow.json");
    let workflow = parse::parse(json).expect("Should parse");
    let serialized = serde_json::to_string(&workflow).expect("Should serialize");
    let workflow2 = parse::parse(&serialized).expect("Should parse again");
    assert_eq!(workflow.id, workflow2.id);
    assert_eq!(workflow.nodes.len(), workflow2.nodes.len());
    assert_eq!(workflow.edges.len(), workflow2.edges.len());
}

#[test]
fn parse_invalid_json_returns_error() {
    let result = parse::parse("not valid json");
    assert!(result.is_err());
    let errors = result.unwrap_err();
    assert!(errors[0].code == "P001");
}

#[test]
fn parse_node_types_correct() {
    let json = include_str!("fixtures/example_workflow.json");
    let workflow = parse::parse(json).expect("Should parse");
    let types: Vec<&str> = workflow.nodes.iter().map(|n| n.node_type()).collect();
    assert!(types.contains(&"cronTrigger"));
    assert!(types.contains(&"httpRequest"));
    assert!(types.contains(&"jsonParse"));
    assert!(types.contains(&"if"));
    assert!(types.contains(&"mintToken"));
    assert!(types.contains(&"stopAndError"));
}

#[test]
fn build_graph_from_example() {
    let json = include_str!("fixtures/example_workflow.json");
    let workflow = parse::parse(json).expect("Should parse");
    let graph = parse::WorkflowGraph::build(&workflow).expect("Should build graph");
    assert_eq!(graph.node_indices.len(), 6);
    // trigger-1 should have 1 successor
    assert_eq!(graph.outgoing_count("trigger-1"), 1);
    // condition-1 (if) should have 2 successors
    assert_eq!(graph.outgoing_count("condition-1"), 2);
    // leaf nodes should have 0 successors
    assert_eq!(graph.outgoing_count("mint-1"), 0);
    assert_eq!(graph.outgoing_count("error-1"), 0);
}

/// Backward compatibility: old workflow JSON with return/log/error nodes still parses.
#[test]
fn parse_legacy_return_log_error() {
    let json = include_str!("fixtures/linear_workflow.json");
    let workflow = parse::parse(json).expect("Should parse legacy return node");
    let types: Vec<&str> = workflow.nodes.iter().map(|n| n.node_type()).collect();
    assert!(types.contains(&"return"), "Legacy return type should parse");
}
