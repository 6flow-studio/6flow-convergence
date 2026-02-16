//! Per-Operation TypeScript emission functions.
//!
//! Each function emits the TypeScript code for one operation variant.
//! Branch/Merge/Filter are handled at the handler level, not here.

use std::collections::HashMap;

use crate::ir::types::*;
use super::fetch_fns::FetchContext;
use super::value_expr::emit_value_expr;
use super::writer::CodeWriter;

/// Emit an HttpRequest call in the handler body.
/// The fetch function is emitted separately by `fetch_fns.rs`.
/// `fetch_contexts` provides dynamic ref info for building augmented config.
pub fn emit_http_request(
    step: &Step,
    op: &HttpRequestOp,
    fetch_contexts: &HashMap<String, FetchContext>,
    w: &mut CodeWriter,
) {
    let fetch_fn_name = format!("fetch_{}", step.id.replace('-', "_"));
    let consensus_expr = emit_consensus(&op.consensus);

    if let Some(ref out) = step.output {
        w.line(&format!("// {}", step.label));

        let ctx = fetch_contexts.get(&step.id);
        let has_dynamic = ctx.map_or(false, |c| !c.dynamic_refs.is_empty());
        let has_auth = ctx.map_or(false, |c| c.has_auth);

        if has_dynamic || has_auth {
            // Fetch the auth secret if needed
            if let Some(ref auth) = op.authentication {
                let secret_var = format!("_authSecret_{}", step.id.replace('-', "_"));
                w.line(&format!(
                    "const {} = runtime.getSecret({{ id: \"{}\" }}).result();",
                    secret_var, auth.token_secret,
                ));
            }

            // Build augmented config
            let cfg_var = format!("_fetchCfg_{}", step.id.replace('-', "_"));
            w.block_open(&format!("const {} =", cfg_var));
            w.line("...runtime.config,");
            if op.authentication.is_some() {
                let secret_var = format!("_authSecret_{}", step.id.replace('-', "_"));
                w.line(&format!("_authToken: {}.value,", secret_var));
            }
            if let Some(c) = ctx {
                for dyn_ref in &c.dynamic_refs {
                    w.line(&format!(
                        "{}: {},",
                        dyn_ref.config_key,
                        emit_value_expr(&dyn_ref.handler_expr),
                    ));
                }
            }
            w.dedent();
            w.line("};");
            w.line(&format!(
                "const {} = httpClient.sendRequest(runtime, {}, {})({}).result();",
                out.variable_name, fetch_fn_name, consensus_expr, cfg_var,
            ));
        } else {
            w.line(&format!(
                "const {} = httpClient.sendRequest(runtime, {}, {})(runtime.config).result();",
                out.variable_name, fetch_fn_name, consensus_expr
            ));
        }
    }
}

/// Emit an EvmRead call.
pub fn emit_evm_read(step: &Step, op: &EvmReadOp, w: &mut CodeWriter) {
    w.line(&format!("// {}", step.label));

    let binding = &op.evm_client_binding;
    let contract = emit_value_expr(&op.contract_address);
    let abi = &op.abi_json;

    if let Some(ref out) = step.output {
        if let Some(ref fields) = out.destructure_fields {
            w.line(&format!(
                "const {{ {} }} = {}.read(runtime, {{",
                fields.join(", "),
                binding,
            ));
        } else {
            w.line(&format!(
                "const {} = {}.read(runtime, {{",
                out.variable_name, binding,
            ));
        }
        w.indent();
        w.line(&format!("contractAddress: {},", contract));
        w.line(&format!("functionName: \"{}\",", op.function_name));
        // Wrap in array if not already one (single ABI item → [item])
        if abi.starts_with('[') {
            w.line(&format!("abi: {},", abi));
        } else {
            w.line(&format!("abi: [{}],", abi));
        }
        if !op.args.is_empty() {
            w.line(&format!("args: [{}],", op.args.iter().map(|a| emit_value_expr(&a.value)).collect::<Vec<_>>().join(", ")));
        }
        w.dedent();
        w.line("}).result();");
    }
}

/// Emit an EvmWrite call.
pub fn emit_evm_write(step: &Step, op: &EvmWriteOp, w: &mut CodeWriter) {
    w.line(&format!("// {}", step.label));
    let binding = &op.evm_client_binding;
    let receiver = emit_value_expr(&op.receiver_address);
    let gas = emit_value_expr(&op.gas_limit);
    let data = emit_value_expr(&op.encoded_data);

    if let Some(ref out) = step.output {
        w.line(&format!(
            "const {} = {}.write(runtime, {{",
            out.variable_name, binding,
        ));
        w.indent();
        w.line(&format!("receiverAddress: {},", receiver));
        w.line(&format!("gasLimit: BigInt({}),", gas));
        w.line(&format!("data: {},", data));
        if let Some(ref value_wei) = op.value_wei {
            w.line(&format!("value: BigInt({}),", emit_value_expr(value_wei)));
        }
        w.dedent();
        w.line("}).result();");
    }
}

/// Emit a GetSecret call.
pub fn emit_get_secret(step: &Step, op: &GetSecretOp, w: &mut CodeWriter) {
    if let Some(ref out) = step.output {
        w.line(&format!("// {}", step.label));
        w.line(&format!(
            "const {} = runtime.getSecret({{ id: \"{}\" }}).result();",
            out.variable_name, op.secret_name,
        ));
    }
}

/// Emit a CodeNode (IIFE with injected bindings).
pub fn emit_code_node(step: &Step, op: &CodeNodeOp, w: &mut CodeWriter) {
    w.line(&format!("// {}", step.label));
    if let Some(ref out) = step.output {
        w.line(&format!("const {} = (() => {{", out.variable_name));
    } else {
        w.line("(() => {");
    }
    w.indent();

    // Inject input bindings
    for binding in &op.input_bindings {
        w.line(&format!(
            "const {} = {};",
            binding.variable_name,
            emit_value_expr(&binding.value),
        ));
    }

    // User code
    for line in op.code.lines() {
        w.line(line);
    }

    w.dedent();
    w.line("})();");
}

/// Emit a JsonParse expression.
pub fn emit_json_parse(step: &Step, op: &JsonParseOp, w: &mut CodeWriter) {
    w.line(&format!("// {}", step.label));
    let input = emit_value_expr(&op.input);

    let parse_expr = if matches!(&op.input, ValueExpr::TriggerDataRef { .. }) {
        // Trigger input is Uint8Array — decode directly
        format!("JSON.parse(new TextDecoder().decode({}))", input)
    } else {
        // HTTP response body is base64-encoded
        format!(
            "JSON.parse(Buffer.from({}, \"base64\").toString(\"utf-8\"))",
            input
        )
    };

    let final_expr = if let Some(ref path) = op.source_path {
        format!("{}{}", parse_expr, path)
    } else {
        parse_expr
    };

    if let Some(ref out) = step.output {
        w.line(&format!("const {} = {};", out.variable_name, final_expr));
    }
}

/// Emit an AbiEncode expression.
pub fn emit_abi_encode(step: &Step, op: &AbiEncodeOp, w: &mut CodeWriter) {
    w.line(&format!("// {}", step.label));
    let args: Vec<String> = op
        .data_mappings
        .iter()
        .map(|m| emit_value_expr(&m.value))
        .collect();

    if let Some(ref out) = step.output {
        w.line(&format!("const {} = {{", out.variable_name));
        w.indent();
        w.line("encoded: encodeFunctionData({");
        w.indent();
        if let Some(ref fn_name) = op.function_name {
            // Convenience node: full function ABI with functionName
            w.line(&format!("abi: [{}],", op.abi_json));
            w.line(&format!("functionName: \"{}\",", fn_name));
        } else {
            // Standalone: parameter-only ABI
            w.line(&format!("abi: {},", op.abi_json));
        }
        w.line(&format!("args: [{}],", args.join(", ")));
        w.dedent();
        w.line("}),");
        w.dedent();
        w.line("};");
    }
}

/// Emit an AbiDecode expression.
pub fn emit_abi_decode(step: &Step, op: &AbiDecodeOp, w: &mut CodeWriter) {
    w.line(&format!("// {}", step.label));
    let input = emit_value_expr(&op.input);

    if let Some(ref out) = step.output {
        if let Some(ref fields) = out.destructure_fields {
            w.line(&format!(
                "const {{ {} }} = decodeFunctionResult({{",
                fields.join(", ")
            ));
        } else {
            w.line(&format!(
                "const {} = decodeFunctionResult({{",
                out.variable_name
            ));
        }
        w.indent();
        w.line(&format!("abi: {},", op.abi_json));
        w.line(&format!("data: {},", input));
        w.dedent();
        w.line("});");
    }
}

/// Emit an AiCall (uses HTTP pattern with provider-specific body).
pub fn emit_ai_call(step: &Step, op: &AiCallOp, w: &mut CodeWriter) {
    let fetch_fn_name = format!("fetch_{}", step.id.replace('-', "_"));
    let consensus_expr = emit_consensus(&op.consensus);

    if let Some(ref out) = step.output {
        w.line(&format!("// {}", step.label));
        w.line(&format!(
            "const {} = httpClient.sendRequest(runtime, {}, {})(runtime.config).result();",
            out.variable_name, fetch_fn_name, consensus_expr
        ));
    }
}

/// Emit a Log call.
pub fn emit_log(_step: &Step, op: &LogOp, w: &mut CodeWriter) {
    let msg = emit_value_expr(&op.message);
    let prefix = match op.level {
        LogLevel::Debug => "[DEBUG] ",
        LogLevel::Info => "",
        LogLevel::Warn => "[WARN] ",
        LogLevel::Error => "[ERROR] ",
    };

    if prefix.is_empty() {
        w.line(&format!("runtime.log({});", msg));
    } else {
        // Wrap in template literal if not already
        w.line(&format!("runtime.log(`{}${{{}}}`);" , prefix, msg));
    }
}

/// Emit an ErrorThrow.
pub fn emit_error_throw(_step: &Step, op: &ErrorThrowOp, w: &mut CodeWriter) {
    let msg = emit_value_expr(&op.message);
    w.line(&format!("throw new Error({});", msg));
}

/// Emit a Return.
pub fn emit_return(_step: &Step, op: &ReturnOp, w: &mut CodeWriter) {
    let expr = emit_value_expr(&op.expression);
    w.line(&format!("return {};", expr));
}

fn emit_consensus(consensus: &ConsensusStrategy) -> String {
    match consensus {
        ConsensusStrategy::Identical => {
            "consensusIdenticalAggregation()".to_string()
        }
        ConsensusStrategy::MedianByFields { fields } => {
            let field_entries: Vec<String> = fields
                .iter()
                .map(|f| format!("{}: cre.consensus.median()", f))
                .collect();
            format!(
                "new cre.consensus.ConsensusAggregationByFields({{ {} }})",
                field_entries.join(", ")
            )
        }
        ConsensusStrategy::Custom { expr } => expr.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_step(id: &str, label: &str, op: Operation, output: Option<OutputBinding>) -> Step {
        Step {
            id: id.into(),
            source_node_ids: vec![id.into()],
            label: label.into(),
            operation: op,
            output,
        }
    }

    #[test]
    fn test_get_secret() {
        let step = make_step(
            "secret-1",
            "Get API key",
            Operation::GetSecret(GetSecretOp {
                secret_name: "API_KEY".into(),
            }),
            Some(OutputBinding {
                variable_name: "step_secret_1".into(),
                ts_type: "{ value: string }".into(),
                destructure_fields: None,
            }),
        );
        let mut w = CodeWriter::new();
        emit_get_secret(&step, match &step.operation { Operation::GetSecret(op) => op, _ => unreachable!() }, &mut w);
        let out = w.finish();
        assert!(out.contains("runtime.getSecret({ id: \"API_KEY\" }).result()"));
    }

    #[test]
    fn test_json_parse() {
        let step = make_step(
            "parse-1",
            "Parse response",
            Operation::JsonParse(JsonParseOp {
                input: ValueExpr::binding("http-1", "body"),
                source_path: None,
                strict: true,
            }),
            Some(OutputBinding {
                variable_name: "step_parse_1".into(),
                ts_type: "any".into(),
                destructure_fields: None,
            }),
        );
        let mut w = CodeWriter::new();
        emit_json_parse(&step, match &step.operation { Operation::JsonParse(op) => op, _ => unreachable!() }, &mut w);
        let out = w.finish();
        assert!(out.contains("JSON.parse(Buffer.from(step_http_1.body, \"base64\").toString(\"utf-8\"))"));
    }

    #[test]
    fn test_log_warn() {
        let step = make_step(
            "log-1",
            "Log warning",
            Operation::Log(LogOp {
                level: LogLevel::Warn,
                message: ValueExpr::string("something bad"),
            }),
            None,
        );
        let mut w = CodeWriter::new();
        emit_log(&step, match &step.operation { Operation::Log(op) => op, _ => unreachable!() }, &mut w);
        let out = w.finish();
        assert!(out.contains("[WARN]"));
        assert!(out.contains("runtime.log"));
    }

    #[test]
    fn test_return() {
        let step = make_step(
            "return-1",
            "Return result",
            Operation::Return(ReturnOp {
                expression: ValueExpr::string("done"),
            }),
            None,
        );
        let mut w = CodeWriter::new();
        emit_return(&step, match &step.operation { Operation::Return(op) => op, _ => unreachable!() }, &mut w);
        let out = w.finish();
        assert_eq!(out.trim(), "return \"done\";");
    }

    #[test]
    fn test_error_throw() {
        let step = make_step(
            "err-1",
            "Throw error",
            Operation::ErrorThrow(ErrorThrowOp {
                message: ValueExpr::string("failed"),
            }),
            None,
        );
        let mut w = CodeWriter::new();
        emit_error_throw(&step, match &step.operation { Operation::ErrorThrow(op) => op, _ => unreachable!() }, &mut w);
        let out = w.finish();
        assert_eq!(out.trim(), "throw new Error(\"failed\");");
    }
}
