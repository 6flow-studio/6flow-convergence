//! Integration tests for graph-level validation rules (V001–V010).

use compiler::parse;
use compiler::validate;

#[test]
fn validate_example_workflow_passes() {
    let json = include_str!("fixtures/example_workflow.json");
    let workflow = parse::parse(json).expect("Should parse");
    let graph = parse::WorkflowGraph::build(&workflow).expect("Should build graph");
    let errors = validate::validate_graph(&workflow, &graph);
    assert!(errors.is_empty(), "Expected no validation errors, got: {:?}", errors);
}

#[test]
fn v001_no_trigger() {
    let json = include_str!("fixtures/no_trigger.json");
    let workflow = parse::parse(json).unwrap();
    let graph = parse::WorkflowGraph::build(&workflow).unwrap();
    let errors = validate::validate_graph(&workflow, &graph);
    assert!(errors.iter().any(|e| e.code == "V001"), "Should flag no trigger: {:?}", errors);
}

#[test]
fn v004_cycle_detection() {
    let json = include_str!("fixtures/cycle.json");
    let workflow = parse::parse(json).unwrap();
    let graph = parse::WorkflowGraph::build(&workflow).unwrap();
    let errors = validate::validate_graph(&workflow, &graph);
    assert!(errors.iter().any(|e| e.code == "V004"), "Should detect cycle: {:?}", errors);
}

#[test]
fn v005_unreachable_node() {
    let json = include_str!("fixtures/unreachable_node.json");
    let workflow = parse::parse(json).unwrap();
    let graph = parse::WorkflowGraph::build(&workflow).unwrap();
    let errors = validate::validate_graph(&workflow, &graph);
    assert!(errors.iter().any(|e| e.code == "V005"), "Should detect unreachable: {:?}", errors);
}

#[test]
fn v008_if_missing_handle() {
    let json = include_str!("fixtures/if_missing_handle.json");
    let workflow = parse::parse(json).unwrap();
    let graph = parse::WorkflowGraph::build(&workflow).unwrap();
    let errors = validate::validate_graph(&workflow, &graph);
    assert!(errors.iter().any(|e| e.code == "V008"), "Should detect if node issue: {:?}", errors);
}

#[test]
fn v010_self_loop() {
    let json = include_str!("fixtures/self_loop.json");
    let workflow = parse::parse(json).unwrap();
    let graph = parse::WorkflowGraph::build(&workflow).unwrap();
    let errors = validate::validate_graph(&workflow, &graph);
    assert!(errors.iter().any(|e| e.code == "V010"), "Should detect self-loop: {:?}", errors);
}
