#[allow(dead_code)]
mod helpers;

use compiler::ir::*;
use helpers::*;

/// Serde round-trip helper: serialize to JSON and back, return deserialized.
fn roundtrip(ir: &WorkflowIR) -> WorkflowIR {
    let json = serde_json::to_string_pretty(ir).expect("serialize");
    serde_json::from_str(&json).expect("deserialize")
}

// =============================================================================
// HTTP REQUEST
// =============================================================================

#[test]
fn test_http_request_get() {
    let ir = ir_with_steps_and_deps(
        vec![make_step_with_output(
            "http-1",
            http_get_with_bearer("https://api.example.com/data", "API_KEY"),
            "any",
        )],
        vec![("API_KEY", "API_KEY_VAR")],
        vec![],
    );
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    if let Operation::HttpRequest(op) = &rt.handler_body.steps[0].operation {
        assert!(matches!(op.method, HttpMethod::Get));
        assert_eq!(op.cache_max_age_seconds, Some(60));
        assert!(matches!(&op.authentication, Some(HttpAuth::BearerToken { .. })));
    } else {
        panic!("Expected HttpRequest");
    }
}

#[test]
fn test_http_request_post() {
    let ir = ir_with_steps(vec![make_step_with_output(
        "http-1",
        http_post("https://api.example.com/submit", ValueExpr::raw(r#"JSON.stringify({ key: "val" })"#)),
        "any",
    )]);
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    if let Operation::HttpRequest(op) = &rt.handler_body.steps[0].operation {
        assert!(matches!(op.method, HttpMethod::Post));
        assert!(op.body.is_some());
        assert_eq!(op.headers.len(), 1);
    } else {
        panic!("Expected HttpRequest");
    }
}

// =============================================================================
// EVM READ
// =============================================================================

#[test]
fn test_evm_read() {
    let ir = ir_with_steps_and_deps(
        vec![make_step_with_output(
            "evm-read-1",
            evm_read_op_with_args(
                "evmClient_eth",
                "0xContractAddr",
                "balanceOf",
                vec![EvmArg {
                    abi_type: "address".into(),
                    value: ValueExpr::config("walletAddress"),
                }],
            ),
            "any",
        )],
        vec![],
        vec![("ethereum-sepolia", "evmClient_eth", false)],
    );
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    if let Operation::EvmRead(op) = &rt.handler_body.steps[0].operation {
        assert_eq!(op.function_name, "balanceOf");
        assert_eq!(op.args.len(), 1);
        assert!(op.from_address.is_some());
    } else {
        panic!("Expected EvmRead");
    }
}

// =============================================================================
// EVM WRITE
// =============================================================================

#[test]
fn test_evm_write() {
    let ir = ir_with_steps_and_deps(
        vec![
            make_step_with_output(
                "encode-1",
                abi_encode_op(
                    r#"[{"name":"to","type":"address"}]"#,
                    vec![("to", ValueExpr::config("walletAddress"))],
                ),
                "{ encoded: string }",
            ),
            make_step_with_output(
                "evm-write-1",
                evm_write_op("evmClient_eth", "0xContract", ValueExpr::binding("encode-1", "encoded")),
                "{ txHash: string }",
            ),
        ],
        vec![],
        vec![("ethereum-sepolia", "evmClient_eth", false)],
    );
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    if let Operation::EvmWrite(op) = &rt.handler_body.steps[1].operation {
        assert_eq!(op.evm_client_binding, "evmClient_eth");
    } else {
        panic!("Expected EvmWrite");
    }
}

// =============================================================================
// GET SECRET
// =============================================================================

#[test]
fn test_get_secret() {
    let ir = ir_with_steps_and_deps(
        vec![make_step_with_output("secret-1", get_secret_op("MY_SECRET"), "{ value: string }")],
        vec![("MY_SECRET", "MY_SECRET_VAR")],
        vec![],
    );
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    if let Operation::GetSecret(op) = &rt.handler_body.steps[0].operation {
        assert_eq!(op.secret_name, "MY_SECRET");
    } else {
        panic!("Expected GetSecret");
    }
}

// =============================================================================
// CODE NODE
// =============================================================================

#[test]
fn test_code_node() {
    let ir = ir_with_steps(vec![
        make_step_with_output("http-1", http_get("https://example.com"), "any"),
        make_step_with_output(
            "code-1",
            code_node_op(
                "return input.length;",
                vec![("input", ValueExpr::binding("http-1", "body"))],
            ),
            "number",
        ),
    ]);
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    if let Operation::CodeNode(op) = &rt.handler_body.steps[1].operation {
        assert_eq!(op.code, "return input.length;");
        assert_eq!(op.input_bindings.len(), 1);
        assert_eq!(op.input_bindings[0].variable_name, "input");
    } else {
        panic!("Expected CodeNode");
    }
}

// =============================================================================
// JSON PARSE
// =============================================================================

#[test]
fn test_json_parse() {
    let ir = ir_with_steps(vec![
        make_step_with_output("http-1", http_get("https://example.com"), "any"),
        make_step_with_output(
            "parse-1",
            json_parse_op(ValueExpr::binding("http-1", "body")),
            "any",
        ),
    ]);
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    if let Operation::JsonParse(op) = &rt.handler_body.steps[1].operation {
        assert!(op.strict);
        assert!(op.source_path.is_none());
    } else {
        panic!("Expected JsonParse");
    }
}

// =============================================================================
// ABI ENCODE
// =============================================================================

#[test]
fn test_abi_encode() {
    let ir = ir_with_steps(vec![make_step_with_output(
        "encode-1",
        abi_encode_op(
            r#"[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}]"#,
            vec![
                ("to", ValueExpr::config("walletAddress")),
                ("amount", ValueExpr::config("mintAmount")),
            ],
        ),
        "{ encoded: string }",
    )]);
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    if let Operation::AbiEncode(op) = &rt.handler_body.steps[0].operation {
        assert_eq!(op.data_mappings.len(), 2);
        assert_eq!(op.data_mappings[0].param_name, "to");
    } else {
        panic!("Expected AbiEncode");
    }
}

// =============================================================================
// ABI DECODE
// =============================================================================

#[test]
fn test_abi_decode() {
    let ir = ir_with_steps(vec![
        make_step_with_output("http-1", http_get("https://example.com"), "any"),
        Step {
            id: "decode-1".into(),
            source_node_ids: vec!["decode-1".into()],
            label: "Decode ABI".into(),
            operation: abi_decode_op(
                ValueExpr::binding("http-1", "body"),
                r#"[{"name":"from","type":"address"},{"name":"value","type":"uint256"}]"#,
                vec!["from", "value"],
            ),
            output: Some(OutputBinding {
                variable_name: "step_decode_1".into(),
                ts_type: "any".into(),
                destructure_fields: Some(vec!["from".into(), "value".into()]),
            }),
        },
    ]);
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    if let Operation::AbiDecode(op) = &rt.handler_body.steps[1].operation {
        assert_eq!(op.output_names, vec!["from", "value"]);
    } else {
        panic!("Expected AbiDecode");
    }
    // Verify destructure_fields survived round-trip
    let output = rt.handler_body.steps[1].output.as_ref().unwrap();
    assert_eq!(output.destructure_fields.as_ref().unwrap(), &vec!["from".to_string(), "value".to_string()]);
}

// =============================================================================
// BRANCH — no reconverge (both branches terminate)
// =============================================================================

#[test]
fn test_branch_no_reconverge() {
    let ir = ir_with_steps(vec![make_step(
        "branch-1",
        branch_op(
            ValueExpr::trigger_data("status"),
            ComparisonOp::Equals,
            ValueExpr::string("active"),
            Block {
                steps: vec![make_step("return-t", return_op(ValueExpr::string("active")))],
            },
            Block {
                steps: vec![make_step("return-f", return_op(ValueExpr::string("inactive")))],
            },
            None,
        ),
    )]);
    // Remove the auto-appended return since branch terminates
    let mut ir = ir;
    ir.handler_body.steps.pop(); // remove "return-final"
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    if let Operation::Branch(op) = &rt.handler_body.steps[0].operation {
        assert!(op.reconverge_at.is_none());
        assert_eq!(op.true_branch.steps.len(), 1);
        assert_eq!(op.false_branch.steps.len(), 1);
    } else {
        panic!("Expected Branch");
    }
}

// =============================================================================
// BRANCH — diamond pattern with merge
// =============================================================================

#[test]
fn test_branch_with_merge() {
    let ir = ir_with_steps(vec![
        make_step(
            "branch-1",
            branch_op(
                ValueExpr::trigger_data("value"),
                ComparisonOp::Gt,
                ValueExpr::integer(100),
                Block {
                    steps: vec![make_step_with_output(
                        "log-t",
                        log_op(ValueExpr::string("high")),
                        "void",
                    )],
                },
                Block {
                    steps: vec![make_step_with_output(
                        "log-f",
                        log_op(ValueExpr::string("low")),
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
                    ("true", ValueExpr::string("high")),
                    ("false", ValueExpr::string("low")),
                ],
            ),
            "string",
        ),
    ]);
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    if let Operation::Merge(op) = &rt.handler_body.steps[1].operation {
        assert_eq!(op.branch_step_id, "branch-1");
        assert_eq!(op.inputs.len(), 2);
    } else {
        panic!("Expected Merge");
    }
}

// =============================================================================
// FILTER — early return
// =============================================================================

#[test]
fn test_filter_early_return() {
    let ir = ir_with_steps(vec![make_step(
        "filter-1",
        filter_op(
            ValueExpr::trigger_data("status"),
            ComparisonOp::Equals,
            ValueExpr::string("active"),
            FilterNonMatchBehavior::EarlyReturn {
                message: "Not active".into(),
            },
        ),
    )]);
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    if let Operation::Filter(op) = &rt.handler_body.steps[0].operation {
        assert!(matches!(
            &op.non_match_behavior,
            FilterNonMatchBehavior::EarlyReturn { message } if message == "Not active"
        ));
    } else {
        panic!("Expected Filter");
    }
}

// =============================================================================
// FILTER — skip
// =============================================================================

#[test]
fn test_filter_skip() {
    let ir = ir_with_steps(vec![make_step(
        "filter-1",
        filter_op(
            ValueExpr::trigger_data("enabled"),
            ComparisonOp::Equals,
            ValueExpr::boolean(true),
            FilterNonMatchBehavior::Skip,
        ),
    )]);
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    if let Operation::Filter(op) = &rt.handler_body.steps[0].operation {
        assert!(matches!(&op.non_match_behavior, FilterNonMatchBehavior::Skip));
    } else {
        panic!("Expected Filter");
    }
}

// =============================================================================
// AI CALL
// =============================================================================

#[test]
fn test_ai_call() {
    let ir = ir_with_steps_and_deps(
        vec![make_step_with_output("ai-1", ai_call_op("openai", "OPENAI_KEY"), "any")],
        vec![("OPENAI_KEY", "OPENAI_KEY_VAR")],
        vec![],
    );
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    if let Operation::AiCall(op) = &rt.handler_body.steps[0].operation {
        assert_eq!(op.provider, "openai");
        assert_eq!(op.temperature, Some(0.7));
        assert_eq!(op.max_tokens, Some(256));
        assert_eq!(op.api_key_secret, "OPENAI_KEY");
    } else {
        panic!("Expected AiCall");
    }
}

// =============================================================================
// LOG + ERROR THROW
// =============================================================================

#[test]
fn test_log_and_error() {
    let mut ir = ir_with_steps(vec![
        make_step("log-1", log_op(ValueExpr::string("about to fail"))),
    ]);
    // Replace the auto-appended Return with ErrorThrow
    ir.handler_body.steps.pop();
    ir.handler_body.steps.push(make_step(
        "error-1",
        error_op(ValueExpr::string("something went wrong")),
    ));
    let errors = validate_ir(&ir);
    assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);

    let rt = roundtrip(&ir);
    assert!(matches!(&rt.handler_body.steps[0].operation, Operation::Log(_)));
    assert!(matches!(&rt.handler_body.steps[1].operation, Operation::ErrorThrow(_)));
}
