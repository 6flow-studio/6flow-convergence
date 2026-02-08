use compiler::ir::*;

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
            timezone: None,
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
        authentication: Some(HttpAuth::BearerToken {
            token_secret: token_secret.into(),
        }),
        cache_max_age_seconds: Some(60),
        timeout_ms: Some(5000),
        expected_status_codes: vec![200],
        response_format: HttpResponseFormat::Json,
        consensus: ConsensusStrategy::Identical,
    })
}

pub fn http_get_with_basic_auth(url: &str, user_secret: &str, pass_secret: &str) -> Operation {
    Operation::HttpRequest(HttpRequestOp {
        method: HttpMethod::Get,
        url: ValueExpr::string(url),
        headers: vec![],
        query_params: vec![],
        body: None,
        authentication: Some(HttpAuth::BasicAuth {
            username_secret: user_secret.into(),
            password_secret: pass_secret.into(),
        }),
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
        abi_json: format!(r#"[{{"name":"{}","type":"function","inputs":[],"outputs":[]}}]"#, func),
        args: vec![],
        from_address: None,
        block_number: None,
    })
}

pub fn evm_read_op_with_args(chain: &str, contract: &str, func: &str, args: Vec<EvmArg>) -> Operation {
    Operation::EvmRead(EvmReadOp {
        evm_client_binding: chain.into(),
        contract_address: ValueExpr::string(contract),
        function_name: func.into(),
        abi_json: r#"[]"#.into(),
        args,
        from_address: Some(ValueExpr::string("0x0000000000000000000000000000000000000000")),
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
        abi_params_json: params.into(),
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
        abi_params_json: params.into(),
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
