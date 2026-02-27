#[allow(dead_code)]
mod helpers;

use compiler::ir::*;
use helpers::*;

// =============================================================================
// Linear chain: trigger → http → parse → code → return
// =============================================================================

#[test]
fn test_linear_chain() {
    let ir = ir_with_steps(vec![
        make_step_with_output("http-1", http_get("https://api.example.com"), "any"),
        make_step_with_output(
            "parse-1",
            json_parse_op(ValueExpr::binding("http-1", "body")),
            "any",
        ),
        make_step_with_output(
            "code-1",
            code_node_op(
                "return data.length;",
                vec![("data", ValueExpr::binding("parse-1", ""))],
            ),
            "number",
        ),
    ]);
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);
    // 4 steps total (3 + return-final)
    assert_eq!(ir.handler_body.steps.len(), 4);
}

// =============================================================================
// Diamond pattern: trigger → if → A/B → merge → return
// =============================================================================

#[test]
fn test_diamond_pattern() {
    let ir = ir_with_steps(vec![
        make_step_with_output("http-1", http_get("https://api.example.com"), "any"),
        make_step(
            "branch-1",
            branch_op(
                ValueExpr::binding("http-1", "statusCode"),
                ComparisonOp::Equals,
                ValueExpr::integer(200),
                Block {
                    steps: vec![make_step_with_output(
                        "ok-log",
                        noop_op(),
                        "void",
                    )],
                },
                Block {
                    steps: vec![make_step_with_output(
                        "err-log",
                        noop_op(),
                        "void",
                    )],
                },
                Some("merge-1"),
            ),
        ),
        make_step_with_output(
            "merge-1",
            merge_op(
                "branch-1",
                vec![
                    ("true", ValueExpr::string("ok")),
                    ("false", ValueExpr::string("error")),
                ],
            ),
            "string",
        ),
    ]);
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);
}

// =============================================================================
// Nested branches: trigger → if → (if → X/Y → merge) / Z → merge → return
// =============================================================================

#[test]
fn test_nested_branches() {
    let ir = ir_with_steps(vec![
        make_step_with_output("http-1", http_get("https://example.com"), "any"),
        make_step(
            "outer-branch",
            branch_op(
                ValueExpr::binding("http-1", "statusCode"),
                ComparisonOp::Equals,
                ValueExpr::integer(200),
                Block {
                    steps: vec![
                        // Inner branch inside true arm
                        make_step(
                            "inner-branch",
                            branch_op(
                                ValueExpr::binding("http-1", "body"),
                                ComparisonOp::Contains,
                                ValueExpr::string("approved"),
                                Block {
                                    steps: vec![make_step_with_output(
                                        "x-step",
                                        noop_op(),
                                        "void",
                                    )],
                                },
                                Block {
                                    steps: vec![make_step_with_output(
                                        "y-step",
                                        noop_op(),
                                        "void",
                                    )],
                                },
                                Some("inner-merge"),
                            ),
                        ),
                        make_step_with_output(
                            "inner-merge",
                            merge_op(
                                "inner-branch",
                                vec![
                                    ("true", ValueExpr::string("approved")),
                                    ("false", ValueExpr::string("denied")),
                                ],
                            ),
                            "string",
                        ),
                    ],
                },
                Block {
                    steps: vec![make_step_with_output(
                        "z-step",
                        noop_op(),
                        "void",
                    )],
                },
                Some("outer-merge"),
            ),
        ),
        make_step_with_output(
            "outer-merge",
            merge_op(
                "outer-branch",
                vec![
                    ("true", ValueExpr::string("processed")),
                    ("false", ValueExpr::string("failed")),
                ],
            ),
            "string",
        ),
    ]);
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);
}

// =============================================================================
// Both branches terminate: trigger → if → (return) / (error) — no merge
// =============================================================================

#[test]
fn test_branch_both_terminate() {
    let mut ir = base_ir();
    ir.handler_body.steps = vec![make_step(
        "branch-1",
        branch_op(
            ValueExpr::trigger_data("status"),
            ComparisonOp::Equals,
            ValueExpr::string("ok"),
            Block {
                steps: vec![make_step(
                    "return-ok",
                    return_op(ValueExpr::string("success")),
                )],
            },
            Block {
                steps: vec![make_step("error-1", error_op(ValueExpr::string("failed")))],
            },
            None,
        ),
    )];
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);
}

// =============================================================================
// Filter then work: trigger → filter → http → return
// =============================================================================

#[test]
fn test_filter_then_work() {
    let ir = ir_with_steps(vec![
        make_step(
            "filter-1",
            filter_op(
                ValueExpr::trigger_data("enabled"),
                ComparisonOp::Equals,
                ValueExpr::boolean(true),
                FilterNonMatchBehavior::EarlyReturn {
                    message: "Disabled".into(),
                },
            ),
        ),
        make_step_with_output("http-1", http_get("https://example.com"), "any"),
    ]);
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);
}

// =============================================================================
// Multi-chain EVM: 2 different EVMClients in same workflow
// =============================================================================

#[test]
fn test_multi_chain_evm() {
    let ir = ir_with_steps_and_deps(
        vec![
            make_step_with_output(
                "read-eth",
                evm_read_op("evmClient_eth", "0xEthContract", "balanceOf"),
                "any",
            ),
            make_step_with_output(
                "read-poly",
                evm_read_op("evmClient_polygon", "0xPolyContract", "totalSupply"),
                "any",
            ),
        ],
        vec![],
        vec![
            ("ethereum-sepolia", "evmClient_eth", false),
            ("polygon-amoy", "evmClient_polygon", false),
        ],
    );
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);
}

// =============================================================================
// Sequential HTTP calls: 3 HTTP calls in sequence (under budget of 5)
// =============================================================================

#[test]
fn test_sequential_http_calls() {
    let ir = ir_with_steps(vec![
        make_step_with_output("http-1", http_get("https://api1.example.com"), "any"),
        make_step_with_output("http-2", http_get("https://api2.example.com"), "any"),
        make_step_with_output("http-3", http_get("https://api3.example.com"), "any"),
    ]);
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);
}

// =============================================================================
// Code node references 2 prior steps
// =============================================================================

#[test]
fn test_code_node_references_prior_steps() {
    let ir = ir_with_steps(vec![
        make_step_with_output("http-1", http_get("https://api1.example.com"), "any"),
        make_step_with_output("http-2", http_get("https://api2.example.com"), "any"),
        make_step_with_output(
            "code-1",
            code_node_op(
                "return a.length + b.length;",
                vec![
                    ("a", ValueExpr::binding("http-1", "body")),
                    ("b", ValueExpr::binding("http-2", "body")),
                ],
            ),
            "number",
        ),
    ]);
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);
}
