//! Per-Operation TypeScript emission functions.
//!
//! Each function emits the TypeScript code for one operation variant.
//! Branch/Merge/Filter are handled at the handler level, not here.

use std::collections::HashMap;

use super::fetch_fns::FetchContext;
use super::value_expr::emit_value_expr;
use super::writer::CodeWriter;
use crate::ir::types::*;

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

/// Emit an EvmRead call using `encodeFunctionData` + `encodeCallMsg` + `callContract`.
///
/// The CRE SDK's `EVMClient` does not have a `.read()` method.
/// The correct pattern is:
///   1. `encodeFunctionData({ abi, functionName, args? })` (from viem) to ABI-encode the call
///   2. `encodeCallMsg({ from, to, data })` (from CRE SDK) to wrap the call message
///   3. `evmClient.callContract(runtime, { call })` to execute the read
pub fn emit_evm_read(step: &Step, op: &EvmReadOp, w: &mut CodeWriter) {
    w.line(&format!("// {}", step.label));

    let binding = &op.evm_client_binding;
    let contract = emit_value_expr(&op.contract_address);
    let abi = &op.abi_json;

    if let Some(ref out) = step.output {
        let safe_id = step.id.replace('-', "_");

        // 1. encodeFunctionData
        let calldata_var = format!("_calldata_{}", safe_id);
        w.line(&format!("const {} = encodeFunctionData({{", calldata_var));
        w.indent();
        // Wrap in array if not already one (single ABI item → [item])
        let abi_array = if abi.starts_with('[') {
            abi.clone()
        } else {
            format!("[{}]", abi)
        };
        w.line(&format!("abi: {} as const,", abi_array));
        w.line(&format!("functionName: \"{}\",", op.function_name));
        if !op.args.is_empty() {
            w.line(&format!(
                "args: [{}],",
                op.args
                    .iter()
                    .map(|a| emit_value_expr(&a.value))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
        w.dedent();
        w.line("});");

        // 2. callContract with encodeCallMsg
        let from_addr = op
            .from_address
            .as_ref()
            .map(|a| emit_value_expr(a))
            .unwrap_or_else(|| "\"0x0000000000000000000000000000000000000000\"".to_string());

        let raw_var = format!("_raw_{}", safe_id);
        w.line(&format!(
            "const {} = {}.callContract(runtime, {{",
            raw_var, binding,
        ));
        w.indent();
        w.line(&format!(
            "call: encodeCallMsg({{ from: {}, to: {}, data: {} }}),",
            from_addr, contract, calldata_var,
        ));
        w.dedent();
        w.line("}).result();");

        // 3. Decode raw bytes
        let bytes_var = format!("_bytes_{}", safe_id);
        w.line(&format!(
            "const {} = new Uint8Array(Object.keys({}.data).length);",
            bytes_var, raw_var
        ));
        w.line(&format!(
            "for (let i = 0; i < {}.length; i++) {0}[i] = {}.data[i];",
            bytes_var, raw_var
        ));
        let decoded_var = format!("_decoded_{}", safe_id);
        w.line(&format!(
            "const {} = decodeFunctionResult({{",
            decoded_var,
        ));
        w.indent();
        w.line(&format!("abi: {} as const,", abi_array));
        w.line(&format!("functionName: \"{}\",", op.function_name));
        w.line(&format!(
            "data: `0x${{Buffer.from({}).toString(\"hex\")}}` as `0x${{string}}`,",
            bytes_var
        ));
        w.dedent();
        w.line("});");

        // 4. Wrap decoded result into named object (matches frontend normalizeReadResult)
        if op.output_names.len() <= 1 {
            let field_name = op.output_names.first().map(|s| s.as_str()).unwrap_or("value");
            w.line(&format!(
                "const {} = {{ {}: {} }};",
                out.variable_name, field_name, decoded_var
            ));
        } else {
            let fields: Vec<String> = op
                .output_names
                .iter()
                .enumerate()
                .map(|(i, name)| format!("{}: {}[{}]", name, decoded_var, i))
                .collect();
            w.line(&format!(
                "const {} = {{ {} }};",
                out.variable_name,
                fields.join(", ")
            ));
        }
    }
}

/// Emit an EvmWrite call using the CRE report-based pattern:
///   1. `runtime.report(prepareReportRequest(data))` — generate signed report
///   2. `evmClient.writeReport(runtime, { receiver, report, gasConfig })` — submit via KeystoneForwarder
pub fn emit_evm_write(step: &Step, op: &EvmWriteOp, w: &mut CodeWriter) {
    w.line(&format!("// {}", step.label));
    let binding = &op.evm_client_binding;
    let receiver = emit_value_expr(&op.receiver_address);
    let gas_str = emit_gas_limit_string(&op.gas_limit);
    let data = emit_value_expr(&op.encoded_data);

    if let Some(ref out) = step.output {
        // Step 1: generate signed report
        let report_var = format!("report_{}", step.id.replace('-', "_"));
        w.line(&format!(
            "const {} = runtime.report(prepareReportRequest({})).result();",
            report_var, data,
        ));

        // Step 2: submit report on-chain
        w.line(&format!(
            "const {} = {}.writeReport(runtime, {{",
            out.variable_name, binding,
        ));
        w.indent();
        w.line(&format!("receiver: {},", receiver));
        w.line(&format!("report: {},", report_var));
        w.line(&format!("gasConfig: {{ gasLimit: {} }},", gas_str));
        w.dedent();
        w.line("}).result();");

        // Step 3: check txStatus
        w.line(&format!(
            "if ({}.txStatus !== TxStatus.SUCCESS) {{",
            out.variable_name,
        ));
        w.indent();
        w.line(&format!(
            "throw new Error(`Failed to write report: ${{{}.errorMessage || {}.txStatus}}`);",
            out.variable_name, out.variable_name,
        ));
        w.dedent();
        w.line("}");

        // Step 4: log txHash
        let tx_hash_var = format!("txHash_{}", step.id.replace('-', "_"));
        w.line(&format!(
            "const {} = {}.txHash || new Uint8Array(32);",
            tx_hash_var, out.variable_name,
        ));
        w.line(&format!(
            "runtime.log(`Write report transaction succeeded at txHash: ${{bytesToHex({})}}`);",
            tx_hash_var,
        ));
    }
}

/// Convert a gas limit `ValueExpr` to a string literal for `gasConfig`.
/// Integer literals become `"500000"`, other expressions use template literals.
fn emit_gas_limit_string(expr: &ValueExpr) -> String {
    match expr {
        ValueExpr::Literal(LiteralValue::Integer { value }) => format!("\"{}\"", value),
        ValueExpr::Literal(LiteralValue::Number { value }) => {
            format!("\"{}\"", *value as i64)
        }
        _ => format!("`${{{}}}`", emit_value_expr(expr)),
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

    // Auto-generate return statement from declared output fields
    if !op.output_fields.is_empty() {
        let fields = op.output_fields.join(", ");
        w.line(&format!("return {{ {} }};", fields));
    }

    w.dedent();
    w.line("})();");
}

fn needs_bigint(ty: &str) -> bool {
    ty.starts_with("uint") || ty.starts_with("int")
}

/// Emit an AbiEncode expression.
pub fn emit_abi_encode(step: &Step, op: &AbiEncodeOp, w: &mut CodeWriter) {
    w.line(&format!("// {}", step.label));

    // Build param_name -> abi_type map from abi_json for BigInt wrapping
    let type_map: HashMap<String, String> =
        serde_json::from_str::<Vec<serde_json::Value>>(&op.abi_json)
            .unwrap_or_default()
            .into_iter()
            .filter_map(|v| {
                let name = v.get("name")?.as_str()?.to_string();
                let ty = v.get("type")?.as_str()?.to_string();
                Some((name, ty))
            })
            .collect();

    let args: Vec<String> = op
        .data_mappings
        .iter()
        .map(|m| {
            let val = emit_value_expr(&m.value);
            if let Some(ty) = type_map.get(&m.param_name) {
                if needs_bigint(ty) {
                    return format!("BigInt({})", val);
                }
            }
            val
        })
        .collect();

    if let Some(ref out) = step.output {
        w.line(&format!("const {} = {{", out.variable_name));
        w.indent();
        if let Some(ref fn_name) = op.function_name {
            // Convenience node: full function ABI with functionName
            w.line("encoded: encodeFunctionData({");
            w.indent();
            w.line(&format!("abi: [{}],", op.abi_json));
            w.line(&format!("functionName: \"{}\",", fn_name));
            w.line(&format!("args: [{}],", args.join(", ")));
            w.dedent();
            w.line("}),");
        } else {
            // Standalone: parameter-only ABI encoding (no function selector)
            w.line(&format!(
                "encoded: encodeAbiParameters({}, [{}]),",
                op.abi_json,
                args.join(", ")
            ));
        }
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
/// Fetches the API key secret and passes it through augmented config to the fetch function.
pub fn emit_ai_call(
    step: &Step,
    op: &AiCallOp,
    fetch_contexts: &HashMap<String, FetchContext>,
    w: &mut CodeWriter,
) {
    let fetch_fn_name = format!("fetch_{}", step.id.replace('-', "_"));
    let consensus_expr = emit_consensus(&op.consensus);

    if let Some(ref out) = step.output {
        w.line(&format!("// {}", step.label));

        // Fetch the API key secret
        let secret_var = format!("_aiApiKey_{}", step.id.replace('-', "_"));
        let secret_name = fetch_contexts
            .get(&step.id)
            .and_then(|c| c.ai_api_key_secret.as_deref())
            .unwrap_or(&op.api_key_secret);
        w.line(&format!(
            "const {} = runtime.getSecret({{ id: \"{}\" }}).result();",
            secret_var, secret_name,
        ));

        let ctx = fetch_contexts.get(&step.id);
        let has_dynamic = ctx.map_or(false, |c| !c.dynamic_refs.is_empty());

        if has_dynamic {
            // Build augmented config with upstream refs
            let cfg_var = format!("_fetchCfg_{}", step.id.replace('-', "_"));
            w.block_open(&format!("const {} =", cfg_var));
            w.line("...runtime.config,");
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
                "const {} = httpClient.sendRequest(runtime, {}, {})({}, {}.value).result();",
                out.variable_name, fetch_fn_name, consensus_expr, cfg_var, secret_var,
            ));
        } else {
            // No dynamic refs — pass runtime.config directly
            w.line(&format!(
                "const {} = httpClient.sendRequest(runtime, {}, {})(runtime.config, {}.value).result();",
                out.variable_name, fetch_fn_name, consensus_expr, secret_var,
            ));
        }
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
        ConsensusStrategy::Identical => "consensusIdenticalAggregation()".to_string(),
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
        emit_return(
            &step,
            match &step.operation {
                Operation::Return(op) => op,
                _ => unreachable!(),
            },
            &mut w,
        );
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
        emit_error_throw(
            &step,
            match &step.operation {
                Operation::ErrorThrow(op) => op,
                _ => unreachable!(),
            },
            &mut w,
        );
        let out = w.finish();
        assert_eq!(out.trim(), "throw new Error(\"failed\");");
    }
}
