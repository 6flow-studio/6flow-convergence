//! SYNC NOTE: Test IR builders/helpers in this file should be updated when
//! node/type changes in `shared/model/node.ts` lead to IR/lowering shape changes.

use compiler::ir::*;

// =============================================================================
// Canonical Test IRs
// =============================================================================

/// KYC-Gated Token Minting workflow IR (canonical example).
pub fn kyc_minting_ir() -> WorkflowIR {
    WorkflowIR {
        metadata: WorkflowMetadata {
            id: "kyc-gated-minting".into(),
            name: "KYC-Gated Token Minting".into(),
            description: Some(
                "Periodically checks KYC status and mints tokens for approved users".into(),
            ),
            version: "1.0.0".into(),
            is_testnet: true,
            default_chain_selector: Some("ethereum-testnet-sepolia".into()),
        },
        trigger: TriggerDef::Cron(CronTriggerDef {
            schedule: ValueExpr::config("schedule"),
        }),
        trigger_param: TriggerParam::CronTrigger,
        config_schema: vec![
            ConfigField {
                name: "schedule".into(),
                zod_type: ZodType::String,
                default_value: Some("TZ=UTC 0 */10 * * * *".into()),
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
        user_rpcs: vec![],
        handler_body: Block {
            steps: vec![
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
                        authentication: Some(HttpAuth {
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
                                Step {
                                    id: "mint-1___encode".into(),
                                    source_node_ids: vec!["mint-1".into()],
                                    label: "ABI encode mint call".into(),
                                    operation: Operation::AbiEncode(AbiEncodeOp {
                                        function_name: Some("mint".into()),
                                        abi_json: r#"{"name":"mint","type":"function","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[],"stateMutability":"nonpayable"}"#.into(),
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
                        reconverge_at: None,
                    }),
                    output: None,
                },
            ],
        },
    }
}

// =============================================================================
// Workflow IR builders
// =============================================================================

/// Minimal valid WorkflowIR with a cron trigger and a single Return step.
pub fn base_ir() -> WorkflowIR {
    WorkflowIR {
        metadata: WorkflowMetadata {
            id: "test-wf".into(),
            name: "Test Workflow".into(),
            description: None,
            version: "1.0.0".into(),
            is_testnet: true,
            default_chain_selector: None,
        },
        trigger: TriggerDef::Cron(CronTriggerDef {
            schedule: ValueExpr::config("schedule"),
        }),
        trigger_param: TriggerParam::CronTrigger,
        config_schema: vec![ConfigField {
            name: "schedule".into(),
            zod_type: ZodType::String,
            default_value: Some("0 */5 * * * *".into()),
            description: None,
        }],
        required_secrets: vec![],
        evm_chains: vec![],
        user_rpcs: vec![],
        handler_body: Block {
            steps: vec![Step {
                id: "return-final".into(),
                source_node_ids: vec!["return-final".into()],
                label: "Return".into(),
                operation: Operation::Return(ReturnOp {
                    expression: ValueExpr::string("ok"),
                }),
                output: None,
            }],
        },
    }
}

/// Build a WorkflowIR with the given steps + an appended Return step.
pub fn ir_with_steps(steps: Vec<Step>) -> WorkflowIR {
    let mut ir = base_ir();
    let mut all_steps = steps;
    all_steps.push(Step {
        id: "return-final".into(),
        source_node_ids: vec!["return-final".into()],
        label: "Return".into(),
        operation: Operation::Return(ReturnOp {
            expression: ValueExpr::string("ok"),
        }),
        output: None,
    });
    ir.handler_body.steps = all_steps;
    ir
}

/// Build a WorkflowIR with steps, secrets, and EVM chains declared.
pub fn ir_with_steps_and_deps(
    steps: Vec<Step>,
    secrets: Vec<(&str, &str)>,
    evm_chains: Vec<(&str, &str, bool)>,
) -> WorkflowIR {
    let mut ir = ir_with_steps(steps);
    ir.required_secrets = secrets
        .into_iter()
        .map(|(name, env)| SecretDeclaration {
            name: name.into(),
            env_variable: env.into(),
        })
        .collect();
    ir.evm_chains = evm_chains
        .into_iter()
        .map(|(selector, binding, trigger)| EvmChainUsage {
            chain_selector_name: selector.into(),
            binding_name: binding.into(),
            used_for_trigger: trigger,
        })
        .collect();
    ir
}

// =============================================================================
// Step builders
// =============================================================================

pub fn make_step(id: &str, op: Operation) -> Step {
    Step {
        id: id.into(),
        source_node_ids: vec![id.into()],
        label: id.into(),
        operation: op,
        output: None,
    }
}

pub fn make_step_with_output(id: &str, op: Operation, ts_type: &str) -> Step {
    Step {
        id: id.into(),
        source_node_ids: vec![id.into()],
        label: id.into(),
        operation: op,
        output: Some(OutputBinding {
            variable_name: format!("step_{}", id.replace('-', "_")),
            ts_type: ts_type.into(),
            destructure_fields: None,
        }),
    }
}

// =============================================================================
// Operation builders
// =============================================================================

pub fn http_get(url: &str) -> Operation {
    Operation::HttpRequest(HttpRequestOp {
        method: HttpMethod::Get,
        url: ValueExpr::string(url),
        headers: vec![],
        query_params: vec![],
        body: None,
        authentication: None,
        cache_max_age_seconds: None,
        timeout_ms: None,
        expected_status_codes: vec![200],
        response_format: HttpResponseFormat::Json,
        consensus: ConsensusStrategy::Identical,
    })
}

pub fn http_post(url: &str, body: ValueExpr) -> Operation {
    Operation::HttpRequest(HttpRequestOp {
        method: HttpMethod::Post,
        url: ValueExpr::string(url),
        headers: vec![("Content-Type".into(), ValueExpr::string("application/json"))],
        query_params: vec![],
        body: Some(HttpBody {
            content_type: HttpContentType::Json,
            data: body,
        }),
        authentication: None,
        cache_max_age_seconds: None,
        timeout_ms: None,
        expected_status_codes: vec![200, 201],
        response_format: HttpResponseFormat::Json,
        consensus: ConsensusStrategy::Identical,
    })
}

pub fn http_get_with_bearer(url: &str, token_secret: &str) -> Operation {
    Operation::HttpRequest(HttpRequestOp {
        method: HttpMethod::Get,
        url: ValueExpr::string(url),
        headers: vec![],
        query_params: vec![],
        body: None,
        authentication: Some(HttpAuth {
            token_secret: token_secret.into(),
        }),
        cache_max_age_seconds: Some(60),
        timeout_ms: Some(5000),
        expected_status_codes: vec![200],
        response_format: HttpResponseFormat::Json,
        consensus: ConsensusStrategy::Identical,
    })
}

pub fn http_get_with_basic_auth(url: &str, _user_secret: &str, _pass_secret: &str) -> Operation {
    // BasicAuth no longer supported — emit as no-auth for backwards compat in tests
    Operation::HttpRequest(HttpRequestOp {
        method: HttpMethod::Get,
        url: ValueExpr::string(url),
        headers: vec![],
        query_params: vec![],
        body: None,
        authentication: None,
        cache_max_age_seconds: None,
        timeout_ms: None,
        expected_status_codes: vec![200],
        response_format: HttpResponseFormat::Json,
        consensus: ConsensusStrategy::Identical,
    })
}

pub fn evm_read_op(chain: &str, contract: &str, func: &str) -> Operation {
    Operation::EvmRead(EvmReadOp {
        evm_client_binding: chain.into(),
        contract_address: ValueExpr::string(contract),
        function_name: func.into(),
        abi_json: format!(
            r#"[{{"name":"{}","type":"function","inputs":[],"outputs":[]}}]"#,
            func
        ),
        args: vec![],
        from_address: None,
        block_number: None,
    })
}

pub fn evm_read_op_with_args(
    chain: &str,
    contract: &str,
    func: &str,
    args: Vec<EvmArg>,
) -> Operation {
    Operation::EvmRead(EvmReadOp {
        evm_client_binding: chain.into(),
        contract_address: ValueExpr::string(contract),
        function_name: func.into(),
        abi_json: r#"[]"#.into(),
        args,
        from_address: Some(ValueExpr::string(
            "0x0000000000000000000000000000000000000000",
        )),
        block_number: None,
    })
}

pub fn evm_write_op(chain: &str, receiver: &str, data: ValueExpr) -> Operation {
    Operation::EvmWrite(EvmWriteOp {
        evm_client_binding: chain.into(),
        receiver_address: ValueExpr::string(receiver),
        gas_limit: ValueExpr::integer(500_000),
        encoded_data: data,
        value_wei: None,
    })
}

pub fn get_secret_op(name: &str) -> Operation {
    Operation::GetSecret(GetSecretOp {
        secret_name: name.into(),
    })
}

pub fn code_node_op(code: &str, inputs: Vec<(&str, ValueExpr)>) -> Operation {
    Operation::CodeNode(CodeNodeOp {
        code: code.into(),
        input_bindings: inputs
            .into_iter()
            .map(|(name, val)| CodeInputBinding {
                variable_name: name.into(),
                value: val,
            })
            .collect(),
        execution_mode: CodeExecutionMode::RunOnceForAll,
        timeout_ms: None,
    })
}

pub fn json_parse_op(input: ValueExpr) -> Operation {
    Operation::JsonParse(JsonParseOp {
        input,
        source_path: None,
        strict: true,
    })
}

pub fn abi_encode_op(params: &str, mappings: Vec<(&str, ValueExpr)>) -> Operation {
    Operation::AbiEncode(AbiEncodeOp {
        function_name: None,
        abi_json: params.into(),
        data_mappings: mappings
            .into_iter()
            .map(|(name, val)| AbiDataMapping {
                param_name: name.into(),
                value: val,
            })
            .collect(),
    })
}

pub fn abi_decode_op(input: ValueExpr, params: &str, outputs: Vec<&str>) -> Operation {
    Operation::AbiDecode(AbiDecodeOp {
        input,
        abi_json: params.into(),
        output_names: outputs.into_iter().map(String::from).collect(),
    })
}

pub fn ai_call_op(provider: &str, secret: &str) -> Operation {
    Operation::AiCall(AiCallOp {
        provider: provider.into(),
        base_url: ValueExpr::string("https://api.openai.com/v1"),
        model: ValueExpr::string("gpt-4"),
        api_key_secret: secret.into(),
        system_prompt: ValueExpr::string("You are a helpful assistant."),
        user_prompt: ValueExpr::string("Hello"),
        temperature: Some(0.7),
        max_tokens: Some(256),
        response_format: AiResponseFormat::Text,
        consensus: ConsensusStrategy::Identical,
    })
}

pub fn filter_op(
    field: ValueExpr,
    op: ComparisonOp,
    val: ValueExpr,
    behavior: FilterNonMatchBehavior,
) -> Operation {
    Operation::Filter(FilterOp {
        conditions: vec![ConditionIR {
            field,
            operator: op,
            value: Some(val),
        }],
        combine_with: LogicCombinator::And,
        non_match_behavior: behavior,
    })
}

pub fn branch_op(
    field: ValueExpr,
    op: ComparisonOp,
    val: ValueExpr,
    true_b: Block,
    false_b: Block,
    reconverge_at: Option<&str>,
) -> Operation {
    Operation::Branch(BranchOp {
        conditions: vec![ConditionIR {
            field,
            operator: op,
            value: Some(val),
        }],
        combine_with: LogicCombinator::And,
        true_branch: true_b,
        false_branch: false_b,
        reconverge_at: reconverge_at.map(String::from),
    })
}

pub fn log_op(msg: ValueExpr) -> Operation {
    Operation::Log(LogOp {
        level: LogLevel::Info,
        message: msg,
    })
}

pub fn error_op(msg: ValueExpr) -> Operation {
    Operation::ErrorThrow(ErrorThrowOp { message: msg })
}

pub fn return_op(expr: ValueExpr) -> Operation {
    Operation::Return(ReturnOp { expression: expr })
}

pub fn merge_op(branch_id: &str, inputs: Vec<(&str, ValueExpr)>) -> Operation {
    Operation::Merge(MergeOp {
        branch_step_id: branch_id.into(),
        strategy: MergeStrategy::PassThrough,
        inputs: inputs
            .into_iter()
            .map(|(name, val)| MergeInput {
                handle_name: name.into(),
                value: val,
            })
            .collect(),
    })
}
