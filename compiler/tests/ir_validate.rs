#[allow(dead_code)]
mod helpers;

use compiler::ir::*;
use helpers::*;

// =============================================================================
// Helper: assert a specific error code is present
// =============================================================================

fn assert_has_error(errors: &[validate::ValidationError], code: &str) {
    assert!(
        errors.iter().any(|e| e.code == code),
        "Expected error {}, got: {:?}",
        code,
        errors
    );
}

fn assert_no_error(errors: &[validate::ValidationError], code: &str) {
    assert!(
        !errors.iter().any(|e| e.code == code),
        "Did not expect error {}, but got: {:?}",
        code,
        errors
    );
}

// =============================================================================
// E002: Duplicate IDs across branches
// =============================================================================

#[test]
fn test_e002_dup_id_across_branches() {
    let mut ir = base_ir();
    ir.handler_body.steps = vec![make_step(
        "branch-1",
        branch_op(
            ValueExpr::trigger_data("x"),
            ComparisonOp::Equals,
            ValueExpr::boolean(true),
            Block {
                steps: vec![
                    make_step("dup-step", log_op(ValueExpr::string("true"))),
                    make_step("return-t", return_op(ValueExpr::string("t"))),
                ],
            },
            Block {
                steps: vec![
                    make_step("dup-step", log_op(ValueExpr::string("false"))), // duplicate!
                    make_step("return-f", return_op(ValueExpr::string("f"))),
                ],
            },
            None,
        ),
    )];
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E002");
}

// =============================================================================
// E003: Cross-branch binding reference
// =============================================================================

#[test]
fn test_e003_cross_branch_ref() {
    let mut ir = base_ir();
    ir.handler_body.steps = vec![make_step(
        "branch-1",
        branch_op(
            ValueExpr::trigger_data("x"),
            ComparisonOp::Equals,
            ValueExpr::boolean(true),
            Block {
                steps: vec![
                    make_step_with_output("true-step", log_op(ValueExpr::string("hi")), "void"),
                    make_step("return-t", return_op(ValueExpr::string("t"))),
                ],
            },
            Block {
                steps: vec![
                    // References "true-step" from the other branch — INVALID
                    make_step(
                        "false-step",
                        json_parse_op(ValueExpr::binding("true-step", "")),
                    ),
                    make_step("return-f", return_op(ValueExpr::string("f"))),
                ],
            },
            None,
        ),
    )];
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E003");
}

#[test]
fn test_e003_binding_from_parent_scope() {
    // Step in branch references binding from parent — VALID
    let ir = ir_with_steps(vec![
        make_step_with_output("http-1", http_get("https://example.com"), "any"),
        make_step(
            "branch-1",
            branch_op(
                ValueExpr::binding("http-1", "statusCode"),
                ComparisonOp::Equals,
                ValueExpr::integer(200),
                Block {
                    steps: vec![
                        // References parent-scoped "http-1" — valid
                        make_step_with_output(
                            "parse-t",
                            json_parse_op(ValueExpr::binding("http-1", "body")),
                            "any",
                        ),
                    ],
                },
                Block { steps: vec![] },
                Some("merge-1"),
            ),
        ),
        make_step_with_output(
            "merge-1",
            merge_op(
                "branch-1",
                vec![
                    ("true", ValueExpr::string("ok")),
                    ("false", ValueExpr::string("skip")),
                ],
            ),
            "string",
        ),
    ]);
    let errors = validate_ir(&ir);
    assert_no_error(&errors, "E003");
}

// =============================================================================
// E004: Merge not immediately after Branch
// =============================================================================

#[test]
fn test_e004_merge_not_immediately_after() {
    let ir = ir_with_steps(vec![
        make_step(
            "branch-1",
            branch_op(
                ValueExpr::trigger_data("x"),
                ComparisonOp::Equals,
                ValueExpr::boolean(true),
                Block {
                    steps: vec![make_step_with_output(
                        "t-step",
                        log_op(ValueExpr::string("t")),
                        "void",
                    )],
                },
                Block {
                    steps: vec![make_step_with_output(
                        "f-step",
                        log_op(ValueExpr::string("f")),
                        "void",
                    )],
                },
                Some("merge-1"),
            ),
        ),
        // Gap: a log step between branch and merge
        make_step("gap-step", log_op(ValueExpr::string("gap"))),
        make_step_with_output(
            "merge-1",
            merge_op(
                "branch-1",
                vec![
                    ("true", ValueExpr::string("t")),
                    ("false", ValueExpr::string("f")),
                ],
            ),
            "string",
        ),
    ]);
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E004");
}

#[test]
fn test_e004_reconverge_at_but_no_more_steps() {
    let mut ir = base_ir();
    ir.handler_body.steps = vec![make_step(
        "branch-1",
        branch_op(
            ValueExpr::trigger_data("x"),
            ComparisonOp::Equals,
            ValueExpr::boolean(true),
            Block {
                steps: vec![make_step("return-t", return_op(ValueExpr::string("t")))],
            },
            Block {
                steps: vec![make_step("return-f", return_op(ValueExpr::string("f")))],
            },
            Some("merge-1"), // declares reconverge but no more steps
        ),
    )];
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E004");
}

// =============================================================================
// E005: Merge references wrong branch ID
// =============================================================================

#[test]
fn test_e005_merge_wrong_branch_id() {
    let ir = ir_with_steps(vec![
        make_step(
            "branch-1",
            branch_op(
                ValueExpr::trigger_data("x"),
                ComparisonOp::Equals,
                ValueExpr::boolean(true),
                Block {
                    steps: vec![make_step_with_output(
                        "t-step",
                        log_op(ValueExpr::string("t")),
                        "void",
                    )],
                },
                Block {
                    steps: vec![make_step_with_output(
                        "f-step",
                        log_op(ValueExpr::string("f")),
                        "void",
                    )],
                },
                Some("merge-1"),
            ),
        ),
        make_step_with_output(
            "merge-1",
            merge_op("wrong-branch-id", vec![("true", ValueExpr::string("t"))]),
            "string",
        ),
    ]);
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E005");
}

// =============================================================================
// E006: reconverge_at points to non-Merge step
// =============================================================================

#[test]
fn test_e006_reconverge_at_non_merge() {
    let ir = ir_with_steps(vec![
        make_step(
            "branch-1",
            branch_op(
                ValueExpr::trigger_data("x"),
                ComparisonOp::Equals,
                ValueExpr::boolean(true),
                Block {
                    steps: vec![make_step_with_output(
                        "t-step",
                        log_op(ValueExpr::string("t")),
                        "void",
                    )],
                },
                Block {
                    steps: vec![make_step_with_output(
                        "f-step",
                        log_op(ValueExpr::string("f")),
                        "void",
                    )],
                },
                Some("not-a-merge"),
            ),
        ),
        // This is a Log, not a Merge
        make_step("not-a-merge", log_op(ValueExpr::string("not merge"))),
    ]);
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E006");
}

// =============================================================================
// E007: Secret validation
// =============================================================================

#[test]
fn test_e007_secret_in_http_bearer_auth() {
    let ir = ir_with_steps(vec![make_step_with_output(
        "http-1",
        http_get_with_bearer("https://example.com", "UNDECLARED_TOKEN"),
        "any",
    )]);
    // required_secrets is empty — bearer token secret undeclared
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E007");
    let e007_count = errors.iter().filter(|e| e.code == "E007").count();
    assert_eq!(
        e007_count, 1,
        "Expected 1 E007 error for undeclared bearer token"
    );
}

#[test]
fn test_e007_secret_in_ai_call() {
    let ir = ir_with_steps(vec![make_step_with_output(
        "ai-1",
        ai_call_op("openai", "UNDECLARED_KEY"),
        "any",
    )]);
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E007");
}

#[test]
fn test_e007_secret_inside_branch() {
    let mut ir = base_ir();
    ir.handler_body.steps = vec![make_step(
        "branch-1",
        branch_op(
            ValueExpr::trigger_data("x"),
            ComparisonOp::Equals,
            ValueExpr::boolean(true),
            Block {
                steps: vec![
                    make_step_with_output(
                        "secret-1",
                        get_secret_op("BRANCH_SECRET"),
                        "{ value: string }",
                    ),
                    make_step("return-t", return_op(ValueExpr::string("t"))),
                ],
            },
            Block {
                steps: vec![make_step("return-f", return_op(ValueExpr::string("f")))],
            },
            None,
        ),
    )];
    // BRANCH_SECRET not declared
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E007");
}

// =============================================================================
// E008: EVM chain validation
// =============================================================================

#[test]
fn test_e008_evm_chain_in_trigger() {
    let mut ir = base_ir();
    ir.trigger = TriggerDef::EvmLog(EvmLogTriggerDef {
        evm_client_binding: "evmClient_nonexistent".into(),
        contract_addresses: vec![ValueExpr::string("0xContract")],
        event_signature: "Transfer(address,address,uint256)".into(),
        event_abi_json: "[]".into(),
        topic_filters: vec![],
        confidence: "0.5".into(),
    });
    ir.trigger_param = TriggerParam::EvmLog;
    // evm_chains is empty — trigger references nonexistent binding
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E008");
}

#[test]
fn test_e008_evm_read_undeclared_chain() {
    let ir = ir_with_steps(vec![make_step_with_output(
        "read-1",
        evm_read_op("evmClient_nonexistent", "0xContract", "balanceOf"),
        "any",
    )]);
    // evm_chains is empty
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E008");
}

// =============================================================================
// E009: HTTP budget (including AiCall counting as HTTP)
// =============================================================================

#[test]
fn test_e009_ai_counts_as_http() {
    let ir = ir_with_steps_and_deps(
        vec![
            make_step_with_output("http-1", http_get("https://a.com"), "any"),
            make_step_with_output("http-2", http_get("https://b.com"), "any"),
            make_step_with_output("http-3", http_get("https://c.com"), "any"),
            make_step_with_output("http-4", http_get("https://d.com"), "any"),
            // 5th "HTTP" is an AI call
            make_step_with_output("ai-1", ai_call_op("openai", "KEY"), "any"),
            // 6th — exceeds budget
            make_step_with_output("ai-2", ai_call_op("openai", "KEY"), "any"),
        ],
        vec![("KEY", "KEY_VAR")],
        vec![],
    );
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E009");
}

#[test]
fn test_e009_budget_worst_branch() {
    // 3 HTTP in true_branch, 2 in false_branch → counts as 3
    // Plus 3 before branch = 6 total → exceeds 5
    let ir = ir_with_steps(vec![
        make_step_with_output("http-1", http_get("https://a.com"), "any"),
        make_step_with_output("http-2", http_get("https://b.com"), "any"),
        make_step_with_output("http-3", http_get("https://c.com"), "any"),
        make_step(
            "branch-1",
            branch_op(
                ValueExpr::trigger_data("x"),
                ComparisonOp::Equals,
                ValueExpr::boolean(true),
                Block {
                    steps: vec![
                        make_step_with_output("http-t1", http_get("https://t1.com"), "any"),
                        make_step_with_output("http-t2", http_get("https://t2.com"), "any"),
                        make_step_with_output("http-t3", http_get("https://t3.com"), "any"),
                    ],
                },
                Block {
                    steps: vec![
                        make_step_with_output("http-f1", http_get("https://f1.com"), "any"),
                        make_step_with_output("http-f2", http_get("https://f2.com"), "any"),
                    ],
                },
                Some("merge-1"),
            ),
        ),
        make_step_with_output(
            "merge-1",
            merge_op(
                "branch-1",
                vec![
                    ("true", ValueExpr::string("t")),
                    ("false", ValueExpr::string("f")),
                ],
            ),
            "string",
        ),
    ]);
    let errors = validate_ir(&ir);
    // 3 (before) + max(3, 2) = 6 > 5
    assert_has_error(&errors, "E009");
}

// =============================================================================
// E010: EVM read budget
// =============================================================================

#[test]
fn test_e010_evm_read_budget() {
    let steps: Vec<Step> = (0..11)
        .map(|i| {
            make_step_with_output(
                &format!("read-{}", i),
                evm_read_op("evmClient_eth", "0xContract", "balanceOf"),
                "any",
            )
        })
        .collect();
    let ir = ir_with_steps_and_deps(
        steps,
        vec![],
        vec![("ethereum-sepolia", "evmClient_eth", false)],
    );
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E010");
}

// =============================================================================
// E011: EVM write budget
// =============================================================================

#[test]
fn test_e011_evm_write_budget() {
    let steps: Vec<Step> = (0..6)
        .map(|i| {
            make_step_with_output(
                &format!("write-{}", i),
                evm_write_op("evmClient_eth", "0xContract", ValueExpr::raw("0x")),
                "any",
            )
        })
        .collect();
    let ir = ir_with_steps_and_deps(
        steps,
        vec![],
        vec![("ethereum-sepolia", "evmClient_eth", false)],
    );
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E011");
}

// =============================================================================
// E012: Return path validation
// =============================================================================

#[test]
fn test_e012_branch_one_side_missing_return() {
    let mut ir = base_ir();
    ir.handler_body.steps = vec![make_step(
        "branch-1",
        branch_op(
            ValueExpr::trigger_data("x"),
            ComparisonOp::Equals,
            ValueExpr::boolean(true),
            Block {
                steps: vec![make_step("return-t", return_op(ValueExpr::string("t")))],
            },
            Block {
                // No return or error — missing termination
                steps: vec![make_step("log-f", log_op(ValueExpr::string("f")))],
            },
            None,
        ),
    )];
    let errors = validate_ir(&ir);
    assert_has_error(&errors, "E012");
}

#[test]
fn test_e012_error_throw_terminates() {
    let mut ir = base_ir();
    ir.handler_body.steps = vec![make_step(
        "branch-1",
        branch_op(
            ValueExpr::trigger_data("x"),
            ComparisonOp::Equals,
            ValueExpr::boolean(true),
            Block {
                steps: vec![make_step("return-t", return_op(ValueExpr::string("ok")))],
            },
            Block {
                steps: vec![make_step("error-f", error_op(ValueExpr::string("fail")))],
            },
            None,
        ),
    )];
    let errors = validate_ir(&ir);
    // ErrorThrow counts as termination — should pass
    assert_no_error(&errors, "E012");
}

#[test]
fn test_e012_merge_then_return() {
    // Diamond pattern: branch → merge → return (valid)
    let ir = ir_with_steps(vec![
        make_step(
            "branch-1",
            branch_op(
                ValueExpr::trigger_data("x"),
                ComparisonOp::Equals,
                ValueExpr::boolean(true),
                Block {
                    steps: vec![make_step_with_output(
                        "t-step",
                        log_op(ValueExpr::string("t")),
                        "void",
                    )],
                },
                Block {
                    steps: vec![make_step_with_output(
                        "f-step",
                        log_op(ValueExpr::string("f")),
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
                    ("true", ValueExpr::string("t")),
                    ("false", ValueExpr::string("f")),
                ],
            ),
            "string",
        ),
        // return-final is auto-appended by ir_with_steps
    ]);
    let errors = validate_ir(&ir);
    assert_no_error(&errors, "E012");
}
