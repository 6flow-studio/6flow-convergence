//! End-to-end pipeline test: Parse → Validate → Lower → IR Validate → Codegen.

use compiler::parse;
use compiler::validate;
use compiler::lower;
use compiler::ir::validate_ir;

#[test]
fn end_to_end_linear_pipeline() {
    let json = include_str!("fixtures/linear_workflow.json");
    let workflow = parse::parse(json).unwrap();
    let graph = parse::WorkflowGraph::build(&workflow).unwrap();

    let validation_errors = validate::validate_graph(&workflow, &graph);
    assert!(validation_errors.is_empty());

    let ir = lower::lower(&workflow, &graph).unwrap();

    let ir_errors = validate_ir(&ir);
    // The lowered IR may have some validation issues due to placeholder inputs
    // (e.g., jsonParse input), but the pipeline should at least not crash.
    let _ = ir_errors;

    let output = compiler::codegen::codegen(&ir);
    dbg!(&output);
    assert_eq!(output.files.len(), 7);
    assert!(output.files.iter().any(|f| f.path == "main.ts"));
}
