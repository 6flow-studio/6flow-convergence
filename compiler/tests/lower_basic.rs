//! Integration tests for the lowering pass: graph → WorkflowIR.

use compiler::parse;
use compiler::validate;
use compiler::lower;
use compiler::ir::types::Operation;

#[test]
fn lower_linear_workflow() {
    let json = include_str!("fixtures/linear_workflow.json");
    let workflow = parse::parse(json).unwrap();
    let graph = parse::WorkflowGraph::build(&workflow).unwrap();
    let errors = validate::validate_graph(&workflow, &graph);
    assert!(errors.is_empty(), "Validation errors: {:?}", errors);

    let ir = lower::lower(&workflow, &graph).expect("Should lower successfully");

    assert_eq!(ir.metadata.id, "linear-test");
    assert_eq!(ir.handler_body.steps.len(), 3); // http, parse, return
    assert_eq!(ir.handler_body.steps[0].id, "h1");
    assert_eq!(ir.handler_body.steps[1].id, "p1");
    assert_eq!(ir.handler_body.steps[2].id, "r1");
    assert_eq!(ir.required_secrets.len(), 1);
    assert_eq!(ir.required_secrets[0].name, "API_KEY");

    // Verify JsonParse auto-wired its input from the HttpRequest predecessor
    let parse_step = &ir.handler_body.steps[1];
    assert_eq!(parse_step.id, "p1");
    match &parse_step.operation {
        Operation::JsonParse(op) => {
            match &op.input {
                compiler::ir::types::ValueExpr::Binding(binding) => {
                    assert_eq!(binding.step_id, "h1");
                    assert_eq!(binding.field_path, "body");
                }
                other => panic!("Expected Binding ValueExpr, got {:?}", other),
            }
        }
        other => panic!("Expected JsonParse operation, got {:?}", other),
    }
}

#[test]
fn lower_example_workflow_produces_valid_ir() {
    let json = include_str!("fixtures/example_workflow.json");
    let workflow = parse::parse(json).unwrap();
    let graph = parse::WorkflowGraph::build(&workflow).unwrap();
    let errors = validate::validate_graph(&workflow, &graph);
    assert!(errors.is_empty(), "Validation errors: {:?}", errors);

    let ir = lower::lower(&workflow, &graph).expect("Should lower successfully");

    assert_eq!(ir.metadata.id, "example-tokenization-workflow");
    assert!(ir.evm_chains.len() >= 1, "Should have at least one EVM chain");
    assert_eq!(ir.required_secrets.len(), 1);
    assert_eq!(ir.required_secrets[0].name, "KYC_API_KEY");

    // The handler body should contain:
    // http-1, parse-1, condition-1 (branch with expanded mint-1 inside true, log+return in false)
    assert!(!ir.handler_body.steps.is_empty());
}

#[test]
fn lower_convenience_node_expansion() {
    // Workflow with mintToken → should expand to AbiEncode + EvmWrite
    let json = include_str!("fixtures/mint_convenience.json");
    let workflow = parse::parse(json).unwrap();
    let graph = parse::WorkflowGraph::build(&workflow).unwrap();
    let ir = lower::lower(&workflow, &graph).expect("Should lower");

    // Should have: mint-1___encode, mint-1___write, r1
    let step_ids: Vec<&str> = ir.handler_body.steps.iter().map(|s| s.id.as_str()).collect();
    assert!(step_ids.contains(&"mint-1___encode"), "Steps: {:?}", step_ids);
    assert!(step_ids.contains(&"mint-1___write"), "Steps: {:?}", step_ids);
    assert!(step_ids.contains(&"r1"), "Steps: {:?}", step_ids);
}
