//! Collect HttpRequest/AiCall steps and emit top-level fetch functions.
//!
//! CRE requires `httpClient.sendRequest(runtime, fetchFn, consensus)(config).result()`
//! where `fetchFn` is a top-level function: `(sendRequester: HTTPSendRequester, config: Config) => T`.
//!
//! **Scope challenge:** Fetch functions only receive `(sendRequester, config)`.
//! Handler-scoped data (trigger data, step bindings, secrets) must be passed through
//! an augmented config object. See `DynamicRef` and `FetchContext`.

use std::collections::HashMap;

use super::value_expr::{emit_value_expr, emit_value_expr_init};
use super::writer::CodeWriter;
use crate::ir::types::*;

// =============================================================================
// PUBLIC TYPES
// =============================================================================

/// Info about a fetch function to emit.
pub struct FetchFnInfo {
    pub fn_name: String,
    pub step_id: String,
    pub kind: FetchFnKind,
}

pub enum FetchFnKind {
    Http(HttpRequestOp),
    Ai(AiCallOp),
}

/// A handler-scoped value that must be passed through the augmented config.
#[derive(Clone)]
pub struct DynamicRef {
    /// Key in the augmented config, e.g. `_dyn0`.
    pub config_key: String,
    /// The original handler-scoped expression (for the handler-side spread).
    pub handler_expr: ValueExpr,
}

/// Context for a single fetch function: dynamic refs + auth info.
pub struct FetchContext {
    pub dynamic_refs: Vec<DynamicRef>,
    pub has_auth: bool,
    /// For AI calls: the secret name to fetch the API key from.
    pub ai_api_key_secret: Option<String>,
}

// =============================================================================
// COLLECT
// =============================================================================

/// Collect all HttpRequest and AiCall steps from the IR (including inside branches).
pub fn collect_fetch_fns(block: &Block) -> Vec<FetchFnInfo> {
    let mut fns = Vec::new();
    collect_from_block(block, &mut fns);
    fns
}

fn collect_from_block(block: &Block, fns: &mut Vec<FetchFnInfo>) {
    for step in &block.steps {
        match &step.operation {
            Operation::HttpRequest(op) => {
                fns.push(FetchFnInfo {
                    fn_name: format!("fetch_{}", step.id.replace('-', "_")),
                    step_id: step.id.clone(),
                    kind: FetchFnKind::Http(op.clone()),
                });
            }
            Operation::AiCall(op) => {
                fns.push(FetchFnInfo {
                    fn_name: format!("fetch_{}", step.id.replace('-', "_")),
                    step_id: step.id.clone(),
                    kind: FetchFnKind::Ai(op.clone()),
                });
            }
            Operation::Branch(branch) => {
                collect_from_block(&branch.true_branch, fns);
                collect_from_block(&branch.false_branch, fns);
            }
            _ => {}
        }
    }
}

// =============================================================================
// DYNAMIC REF ANALYSIS
// =============================================================================

/// Build the FetchContext for an HTTP fetch function.
/// Scans for handler-scoped ValueExprs (Binding, TriggerDataRef) and collects them.
pub fn build_fetch_context(op: &HttpRequestOp) -> FetchContext {
    let mut refs: Vec<DynamicRef> = Vec::new();
    let mut seen: HashMap<String, String> = HashMap::new();
    let mut counter = 0;

    scan_expr(&op.url, &mut refs, &mut seen, &mut counter);
    for (_, v) in &op.headers {
        scan_expr(v, &mut refs, &mut seen, &mut counter);
    }
    if let Some(ref body) = op.body {
        scan_expr(&body.data, &mut refs, &mut seen, &mut counter);
    }

    FetchContext {
        dynamic_refs: refs,
        has_auth: op.authentication.is_some(),
        ai_api_key_secret: None,
    }
}

fn scan_expr(
    expr: &ValueExpr,
    refs: &mut Vec<DynamicRef>,
    seen: &mut HashMap<String, String>,
    counter: &mut usize,
) {
    match expr {
        ValueExpr::Binding(_) | ValueExpr::TriggerDataRef { .. } => {
            let key_str = emit_value_expr(expr);
            if !seen.contains_key(&key_str) {
                let config_key = format!("_dyn{}", *counter);
                seen.insert(key_str, config_key.clone());
                refs.push(DynamicRef {
                    config_key,
                    handler_expr: expr.clone(),
                });
                *counter += 1;
            }
        }
        ValueExpr::Template { parts } => {
            for part in parts {
                if let TemplatePart::Expr { value } = part {
                    scan_expr(value, refs, seen, counter);
                }
            }
        }
        _ => {} // Literal, ConfigRef, RawExpr are fine in fetch scope
    }
}

/// Substitute handler-scoped refs in a ValueExpr with `config._dynN` references.
fn subst_expr(expr: &ValueExpr, mapping: &HashMap<String, String>) -> ValueExpr {
    match expr {
        ValueExpr::Binding(_) | ValueExpr::TriggerDataRef { .. } => {
            let key = emit_value_expr(expr);
            if let Some(config_key) = mapping.get(&key) {
                ValueExpr::RawExpr {
                    expr: format!("config.{}", config_key),
                }
            } else {
                expr.clone()
            }
        }
        ValueExpr::Template { parts } => {
            let new_parts: Vec<TemplatePart> = parts
                .iter()
                .map(|p| match p {
                    TemplatePart::Expr { value } => TemplatePart::Expr {
                        value: subst_expr(value, mapping),
                    },
                    lit => lit.clone(),
                })
                .collect();
            ValueExpr::Template { parts: new_parts }
        }
        _ => expr.clone(),
    }
}

/// Build the substitution mapping from handler expr → config key.
fn build_subst_map(ctx: &FetchContext) -> HashMap<String, String> {
    ctx.dynamic_refs
        .iter()
        .map(|r| (emit_value_expr(&r.handler_expr), r.config_key.clone()))
        .collect()
}

// =============================================================================
// EMIT
// =============================================================================

/// Emit all top-level fetch functions. Returns a map from step_id → FetchContext.
pub fn emit_fetch_fns(
    fetch_fns: &[FetchFnInfo],
    w: &mut CodeWriter,
) -> HashMap<String, FetchContext> {
    let mut contexts = HashMap::new();
    for f in fetch_fns {
        match &f.kind {
            FetchFnKind::Http(op) => {
                let ctx = build_fetch_context(op);
                emit_http_fetch_fn(&f.fn_name, op, &ctx, w);
                contexts.insert(f.step_id.clone(), ctx);
            }
            FetchFnKind::Ai(op) => {
                emit_ai_fetch_fn(&f.fn_name, op, w);
                contexts.insert(
                    f.step_id.clone(),
                    FetchContext {
                        dynamic_refs: Vec::new(),
                        has_auth: true,
                        ai_api_key_secret: Some(op.api_key_secret.clone()),
                    },
                );
            }
        }
        w.blank();
    }
    contexts
}

fn emit_http_fetch_fn(fn_name: &str, op: &HttpRequestOp, ctx: &FetchContext, w: &mut CodeWriter) {
    let method = match op.method {
        HttpMethod::Get => "GET",
        HttpMethod::Post => "POST",
        HttpMethod::Put => "PUT",
        HttpMethod::Delete => "DELETE",
        HttpMethod::Patch => "PATCH",
        HttpMethod::Head => "HEAD",
    };

    let needs_any = !ctx.dynamic_refs.is_empty() || ctx.has_auth;
    let config_type = if needs_any { "any" } else { "Config" };

    w.block_open(&format!(
        "const {} = (sendRequester: HTTPSendRequester, config: {}) =>",
        fn_name, config_type
    ));

    let subst = build_subst_map(ctx);

    // Build request object
    w.block_open("const req =");
    let url_expr = subst_expr(&op.url, &subst);
    w.line(&format!("url: {},", emit_value_expr_init(&url_expr)));
    w.line(&format!("method: \"{}\" as const,", method));

    // Headers (user-defined + auth)
    let has_user_headers = !op.headers.is_empty();
    let has_auth = op.authentication.is_some();
    if has_user_headers || has_auth {
        w.block_open("headers:");
        for (key, value) in &op.headers {
            let v = subst_expr(value, &subst);
            w.line(&format!("\"{}\": {},", key, emit_value_expr_init(&v)));
        }
        if has_auth {
            w.line("\"Authorization\": `Bearer ${config._authToken}`,");
        }
        w.dedent();
        w.line("},");
    }

    // Body
    if let Some(ref body) = op.body {
        let data_expr = subst_expr(&body.data, &subst);
        let data_str = emit_value_expr_init(&data_expr);
        match body.content_type {
            HttpContentType::Json => {
                w.line(&format!(
                    "body: Buffer.from(new TextEncoder().encode(JSON.stringify({}))).toString(\"base64\"),",
                    data_str
                ));
            }
            _ => {
                w.line(&format!("body: {},", data_str));
            }
        }
    }

    // Cache settings
    if let Some(max_age) = op.cache_max_age_seconds {
        w.block_open("cacheSettings:");
        w.line("store: true,");
        w.line(&format!("maxAge: {{ seconds: {}n }},", max_age));
        w.dedent();
        w.line("},");
    }

    w.dedent();
    w.line("};");

    // Send request
    w.blank();
    w.line("const resp = sendRequester.sendRequest(req).result();");
    w.blank();

    // Check response
    if !op.expected_status_codes.is_empty() {
        w.block_open("if (!ok(resp))");
        w.line("throw new Error(`HTTP request failed with status: ${resp.statusCode}`);");
        w.block_close();
        w.blank();
    }

    // Return based on response format
    match op.response_format {
        HttpResponseFormat::Json => {
            w.line(
                "return { statusCode: resp.statusCode, body: resp.body, headers: resp.headers };",
            );
        }
        HttpResponseFormat::Text => {
            w.line("return { statusCode: resp.statusCode, body: new TextDecoder().decode(resp.body), headers: resp.headers };");
        }
        HttpResponseFormat::Binary => {
            w.line(
                "return { statusCode: resp.statusCode, body: resp.body, headers: resp.headers };",
            );
        }
    }

    w.block_close_semi();
}

fn emit_ai_fetch_fn(fn_name: &str, op: &AiCallOp, w: &mut CodeWriter) {
    // AI fetch functions receive apiKey as a third parameter (passed from handler)
    w.block_open(&format!(
        "const {} = (sendRequester: HTTPSendRequester, config: any, apiKey: string) =>",
        fn_name
    ));

    let base_url = emit_value_expr_init(&op.base_url);
    let model = emit_value_expr_init(&op.model);
    let system_prompt = emit_value_expr_init(&op.system_prompt);
    let user_prompt = emit_value_expr_init(&op.user_prompt);

    let provider = op.provider.as_str();

    // Build request body — provider-specific format
    match provider {
        "google" => emit_google_body(w, &model, &system_prompt, &user_prompt, op),
        "anthropic" => emit_anthropic_body(w, &model, &system_prompt, &user_prompt, op),
        _ => emit_openai_body(w, &model, &system_prompt, &user_prompt, op), // OpenAI-compatible default
    }

    w.line("const bodyBytes = new TextEncoder().encode(JSON.stringify(body));");
    w.blank();

    // Build request object with provider-specific auth headers
    w.block_open("const req =");
    w.line(&format!("url: {},", base_url));
    w.line("method: \"POST\" as const,");
    w.line("body: Buffer.from(bodyBytes).toString(\"base64\"),");
    w.block_open("headers:");
    w.line("\"Content-Type\": \"application/json\",");
    match provider {
        "google" => {
            w.line("\"x-goog-api-key\": apiKey,");
        }
        "anthropic" => {
            w.line("\"x-api-key\": apiKey,");
            w.line("\"anthropic-version\": \"2023-06-01\",");
        }
        _ => {
            // OpenAI-compatible
            w.line("\"Authorization\": `Bearer ${apiKey}`,");
        }
    }
    w.dedent();
    w.line("},");
    w.dedent();
    w.line("};");
    w.blank();

    w.line("const resp = sendRequester.sendRequest(req).result();");
    w.blank();
    w.block_open("if (!ok(resp))");
    w.line("throw new Error(`AI call failed with status: ${resp.statusCode}`);");
    w.block_close();
    w.blank();
    w.line("return JSON.parse(Buffer.from(resp.body, \"base64\").toString(\"utf-8\"));");

    w.block_close_semi();
}

fn emit_openai_body(
    w: &mut CodeWriter,
    model: &str,
    system_prompt: &str,
    user_prompt: &str,
    op: &AiCallOp,
) {
    w.block_open("const body =");
    w.line(&format!("model: {},", model));
    w.line("messages: [");
    w.indent();
    w.line(&format!(
        "{{ role: \"system\", content: {} }},",
        system_prompt
    ));
    w.line(&format!("{{ role: \"user\", content: {} }},", user_prompt));
    w.dedent();
    w.line("],");
    if let Some(temp) = op.temperature {
        w.line(&format!("temperature: {},", temp));
    }
    if let Some(max) = op.max_tokens {
        w.line(&format!("max_tokens: {},", max));
    }
    w.dedent();
    w.line("};");
    w.blank();
}

fn emit_anthropic_body(
    w: &mut CodeWriter,
    model: &str,
    system_prompt: &str,
    user_prompt: &str,
    op: &AiCallOp,
) {
    w.block_open("const body =");
    w.line(&format!("model: {},", model));
    w.line(&format!("system: {},", system_prompt));
    w.line("messages: [");
    w.indent();
    w.line(&format!("{{ role: \"user\", content: {} }},", user_prompt));
    w.dedent();
    w.line("],");
    if let Some(temp) = op.temperature {
        w.line(&format!("temperature: {},", temp));
    }
    if let Some(max) = op.max_tokens {
        w.line(&format!("max_tokens: {},", max));
    }
    w.dedent();
    w.line("};");
    w.blank();
}

fn emit_google_body(
    w: &mut CodeWriter,
    _model: &str,
    system_prompt: &str,
    user_prompt: &str,
    op: &AiCallOp,
) {
    w.block_open("const body =");
    // Google uses system_instruction for system prompts
    w.block_open("system_instruction:");
    w.line(&format!("parts: [{{ text: {} }}],", system_prompt));
    w.dedent();
    w.line("},");
    // Google uses contents array with parts
    w.line("contents: [");
    w.indent();
    w.line(&format!(
        "{{ role: \"user\", parts: [{{ text: {} }}] }},",
        user_prompt
    ));
    w.dedent();
    w.line("],");
    // Google nests temperature/maxOutputTokens under generationConfig
    let has_config = op.temperature.is_some() || op.max_tokens.is_some();
    if has_config {
        w.block_open("generationConfig:");
        if let Some(temp) = op.temperature {
            w.line(&format!("temperature: {},", temp));
        }
        if let Some(max) = op.max_tokens {
            w.line(&format!("maxOutputTokens: {},", max));
        }
        w.dedent();
        w.line("},");
    }
    w.dedent();
    w.line("};");
    w.blank();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collect_finds_http_in_branches() {
        let block = Block {
            steps: vec![Step {
                id: "condition-1".into(),
                source_node_ids: vec![],
                label: "branch".into(),
                operation: Operation::Branch(BranchOp {
                    conditions: vec![],
                    combine_with: LogicCombinator::And,
                    true_branch: Block {
                        steps: vec![Step {
                            id: "http-inner".into(),
                            source_node_ids: vec![],
                            label: "inner http".into(),
                            operation: Operation::HttpRequest(HttpRequestOp {
                                method: HttpMethod::Get,
                                url: ValueExpr::string("https://example.com"),
                                headers: vec![],
                                query_params: vec![],
                                body: None,
                                authentication: None,
                                cache_max_age_seconds: None,
                                timeout_ms: None,
                                expected_status_codes: vec![],
                                response_format: HttpResponseFormat::Json,
                                consensus: ConsensusStrategy::Identical,
                            }),
                            output: None,
                        }],
                    },
                    false_branch: Block { steps: vec![] },
                    reconverge_at: None,
                }),
                output: None,
            }],
        };

        let fns = collect_fetch_fns(&block);
        assert_eq!(fns.len(), 1);
        assert_eq!(fns[0].fn_name, "fetch_http_inner");
    }
}
