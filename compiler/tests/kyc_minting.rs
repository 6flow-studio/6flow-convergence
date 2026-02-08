//! Integration test: KYC-Gated Token Minting workflow.
//!
//! This is the canonical example from `shared/model/node.ts`.
//! Visual graph:
//!   [cronTrigger] → [httpRequest] → [jsonParse] → [if]
//!                                                   ├─ true → [abiEncode] → [evmWrite] → [return]
//!                                                   └─ false → [log] → [return]
//!
//! The mintToken convenience node has been pre-expanded into abiEncode + evmWrite.

use compiler::ir::*;

fn kyc_minting_ir() -> WorkflowIR {
    WorkflowIR {
        metadata: WorkflowMetadata {
            id: "kyc-gated-minting".into(),
            name: "KYC-Gated Token Minting".into(),
            description: Some("Periodically checks KYC status and mints tokens for approved users".into()),
            version: "1.0.0".into(),
            is_testnet: true,
            default_chain_selector: Some("ethereum-testnet-sepolia".into()),
        },
        trigger: TriggerDef::Cron(CronTriggerDef {
            schedule: ValueExpr::config("schedule"),
            timezone: Some(ValueExpr::string("UTC")),
        }),
        trigger_param: TriggerParam::CronTrigger,
        config_schema: vec![
            ConfigField {
                name: "schedule".into(),
                zod_type: ZodType::String,
                default_value: Some("0 */10 * * * *".into()),
                description: Some("Cron schedule (min 30s interval)".into()),
            },
            ConfigField {
                name: "walletAddress".into(),
                zod_type: ZodType::String,
                default_value: None,
                description: Some("Wallet address to check KYC for".into()),
            },
            ConfigField {
                name: "tokenContractAddress".into(),
                zod_type: ZodType::String,
                default_value: None,
                description: Some("ERC-20 token contract address".into()),
            },
            ConfigField {
                name: "mintAmount".into(),
                zod_type: ZodType::String,
                default_value: None,
                description: Some("Amount to mint (in wei)".into()),
            },
        ],
        required_secrets: vec![SecretDeclaration {
            name: "KYC_API_KEY".into(),
            env_variable: "KYC_API_KEY_VAR".into(),
        }],
        evm_chains: vec![EvmChainUsage {
            chain_selector_name: "ethereum-testnet-sepolia".into(),
            binding_name: "evmClient_eth_sepolia".into(),
            used_for_trigger: false,
        }],
        handler_body: Block {
            steps: vec![
                // Step 0: HTTP GET to KYC API
                Step {
                    id: "http-1".into(),
                    source_node_ids: vec!["http-1".into()],
                    label: "Fetch KYC status".into(),
                    operation: Operation::HttpRequest(HttpRequestOp {
                        method: HttpMethod::Get,
                        url: ValueExpr::Template {
                            parts: vec![
                                TemplatePart::Lit {
                                    value: "https://kyc-api.example.com/status/".into(),
                                },
                                TemplatePart::Expr {
                                    value: ValueExpr::config("walletAddress"),
                                },
                            ],
                        },
                        headers: vec![],
                        query_params: vec![],
                        body: None,
                        authentication: Some(HttpAuth::BearerToken {
                            token_secret: "KYC_API_KEY".into(),
                        }),
                        cache_max_age_seconds: Some(60),
                        timeout_ms: Some(5000),
                        expected_status_codes: vec![200],
                        response_format: HttpResponseFormat::Json,
                        consensus: ConsensusStrategy::Identical,
                    }),
                    output: Some(OutputBinding {
                        variable_name: "step_http_1".into(),
                        ts_type: "{ statusCode: number; body: string; headers: Record<string, string> }".into(),
                        destructure_fields: None,
                    }),
                },
                // Step 1: Parse JSON response
                Step {
                    id: "parse-1".into(),
                    source_node_ids: vec!["parse-1".into()],
                    label: "Parse KYC response".into(),
                    operation: Operation::JsonParse(JsonParseOp {
                        input: ValueExpr::binding("http-1", "body"),
                        source_path: None,
                        strict: true,
                    }),
                    output: Some(OutputBinding {
                        variable_name: "step_parse_1".into(),
                        ts_type: "any".into(),
                        destructure_fields: None,
                    }),
                },
                // Step 2: Branch on isApproved
                Step {
                    id: "condition-1".into(),
                    source_node_ids: vec!["condition-1".into()],
                    label: "Check if KYC approved".into(),
                    operation: Operation::Branch(BranchOp {
                        conditions: vec![ConditionIR {
                            field: ValueExpr::binding("parse-1", "isApproved"),
                            operator: ComparisonOp::Equals,
                            value: Some(ValueExpr::boolean(true)),
                        }],
                        combine_with: LogicCombinator::And,
                        true_branch: Block {
                            steps: vec![
                                // ABI encode mint(address, uint256)
                                Step {
                                    id: "mint-1___encode".into(),
                                    source_node_ids: vec!["mint-1".into()],
                                    label: "ABI encode mint call".into(),
                                    operation: Operation::AbiEncode(AbiEncodeOp {
                                        abi_params_json: r#"[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}]"#.into(),
                                        data_mappings: vec![
                                            AbiDataMapping {
                                                param_name: "to".into(),
                                                value: ValueExpr::config("walletAddress"),
                                            },
                                            AbiDataMapping {
                                                param_name: "amount".into(),
                                                value: ValueExpr::config("mintAmount"),
                                            },
                                        ],
                                    }),
                                    output: Some(OutputBinding {
                                        variable_name: "step_mint_1___encode".into(),
                                        ts_type: "{ encoded: string }".into(),
                                        destructure_fields: None,
                                    }),
                                },
                                // EVM write (mint)
                                Step {
                                    id: "mint-1___write".into(),
                                    source_node_ids: vec!["mint-1".into()],
                                    label: "Execute mint transaction".into(),
                                    operation: Operation::EvmWrite(EvmWriteOp {
                                        evm_client_binding: "evmClient_eth_sepolia".into(),
                                        receiver_address: ValueExpr::config("tokenContractAddress"),
                                        gas_limit: ValueExpr::integer(1_000_000),
                                        encoded_data: ValueExpr::binding("mint-1___encode", "encoded"),
                                        value_wei: None,
                                    }),
                                    output: Some(OutputBinding {
                                        variable_name: "step_mint_1___write".into(),
                                        ts_type: "{ txHash: string; status: string }".into(),
                                        destructure_fields: None,
                                    }),
                                },
                                // Return success
                                Step {
                                    id: "return-1".into(),
                                    source_node_ids: vec!["return-1".into()],
                                    label: "Return mint success".into(),
                                    operation: Operation::Return(ReturnOp {
                                        expression: ValueExpr::string("Minted successfully"),
                                    }),
                                    output: None,
                                },
                            ],
                        },
                        false_branch: Block {
                            steps: vec![
                                // Log rejection
                                Step {
                                    id: "log-1".into(),
                                    source_node_ids: vec!["log-1".into()],
                                    label: "Log KYC rejection".into(),
                                    operation: Operation::Log(LogOp {
                                        level: LogLevel::Warn,
                                        message: ValueExpr::Template {
                                            parts: vec![
                                                TemplatePart::Lit {
                                                    value: "User ".into(),
                                                },
                                                TemplatePart::Expr {
                                                    value: ValueExpr::config("walletAddress"),
                                                },
                                                TemplatePart::Lit {
                                                    value: " not KYC approved".into(),
                                                },
                                            ],
                                        },
                                    }),
                                    output: None,
                                },
                                // Return rejection
                                Step {
                                    id: "return-2".into(),
                                    source_node_ids: vec!["return-2".into()],
                                    label: "Return rejection".into(),
                                    operation: Operation::Return(ReturnOp {
                                        expression: ValueExpr::string("KYC not approved"),
                                    }),
                                    output: None,
                                },
                            ],
                        },
                        reconverge_at: None, // Both branches return independently
                    }),
                    output: None,
                },
            ],
        },
    }
}

#[test]
fn kyc_minting_ir_validates() {
    let ir = kyc_minting_ir();
    let errors = validate_ir(&ir);
    assert!(
        errors.is_empty(),
        "KYC minting IR should be valid, but got errors: {:#?}",
        errors
    );
}

#[test]
fn kyc_minting_ir_serializes_to_json() {
    let ir = kyc_minting_ir();
    let json = serde_json::to_string_pretty(&ir).expect("IR should serialize to JSON");

    // Verify it round-trips
    let deserialized: WorkflowIR =
        serde_json::from_str(&json).expect("IR JSON should deserialize back");
    assert_eq!(deserialized.metadata.id, "kyc-gated-minting");
    assert_eq!(deserialized.handler_body.steps.len(), 3);

    // Verify the branch structure
    if let Operation::Branch(branch) = &deserialized.handler_body.steps[2].operation {
        assert_eq!(branch.true_branch.steps.len(), 3); // encode, write, return
        assert_eq!(branch.false_branch.steps.len(), 2); // log, return
        assert!(branch.reconverge_at.is_none());
    } else {
        panic!("Step 2 should be a Branch");
    }
}

#[test]
fn kyc_minting_ir_snapshot() {
    let ir = kyc_minting_ir();
    insta::assert_json_snapshot!("kyc_minting_ir", ir);
}

/// Test that modifying the IR to break an invariant is caught.
#[test]
fn kyc_minting_undeclared_chain_fails() {
    let mut ir = kyc_minting_ir();
    ir.evm_chains.clear(); // Remove the chain declaration
    let errors = validate_ir(&ir);
    assert!(
        errors.iter().any(|e| e.code == "E008"),
        "Should fail with E008 for missing evm chain, got: {:#?}",
        errors
    );
}

#[test]
fn kyc_minting_undeclared_secret_fails() {
    let mut ir = kyc_minting_ir();
    ir.required_secrets.clear(); // Remove secret declaration
    let errors = validate_ir(&ir);
    assert!(
        errors.iter().any(|e| e.code == "E007"),
        "Should fail with E007 for missing secret, got: {:#?}",
        errors
    );
}
