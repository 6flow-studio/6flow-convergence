//! Collect HttpRequest/AiCall steps and emit top-level fetch functions.
//!
//! CRE requires `httpClient.sendRequest(runtime, fetchFn, consensus)(config).result()`
//! where `fetchFn` is a top-level function: `(sendRequester: HTTPSendRequester, config: Config) => T`.

use crate::ir::types::*;
use super::value_expr::emit_value_expr_init;
use super::writer::CodeWriter;

/// Info about a fetch function to emit.
pub struct FetchFnInfo {
    pub fn_name: String,
    #[allow(dead_code)]
    pub step_id: String,
    pub kind: FetchFnKind,
}

pub enum FetchFnKind {
    Http(HttpRequestOp),
    Ai(AiCallOp),
}

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

/// Emit all top-level fetch functions.
pub fn emit_fetch_fns(fetch_fns: &[FetchFnInfo], w: &mut CodeWriter) {
    for f in fetch_fns {
        match &f.kind {
            FetchFnKind::Http(op) => emit_http_fetch_fn(&f.fn_name, op, w),
            FetchFnKind::Ai(op) => emit_ai_fetch_fn(&f.fn_name, op, w),
        }
        w.blank();
    }
}

fn emit_http_fetch_fn(fn_name: &str, op: &HttpRequestOp, w: &mut CodeWriter) {
    let method = match op.method {
        HttpMethod::Get => "GET",
        HttpMethod::Post => "POST",
        HttpMethod::Put => "PUT",
        HttpMethod::Delete => "DELETE",
        HttpMethod::Patch => "PATCH",
        HttpMethod::Head => "HEAD",
    };

    w.block_open(&format!(
        "const {} = (sendRequester: HTTPSendRequester, config: Config) =>",
        fn_name
    ));

    // Build request object
    w.block_open("const req =");
    w.line(&format!("url: {},", emit_value_expr_init(&op.url)));
    w.line(&format!("method: \"{}\" as const,", method));

    // Headers
    if !op.headers.is_empty() {
        w.block_open("headers:");
        for (key, value) in &op.headers {
            w.line(&format!("\"{}\": {},", key, emit_value_expr_init(value)));
        }
        w.dedent();
        w.line("},");
    }

    // Body
    if let Some(ref body) = op.body {
        let data_expr = emit_value_expr_init(&body.data);
        match body.content_type {
            HttpContentType::Json => {
                w.line(&format!(
                    "body: Buffer.from(new TextEncoder().encode(JSON.stringify({}))).toString(\"base64\"),",
                    data_expr
                ));
            }
            _ => {
                w.line(&format!("body: {},", data_expr));
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
            w.line("return { statusCode: resp.statusCode, body: resp.body, headers: resp.headers };");
        }
        HttpResponseFormat::Text => {
            w.line("return { statusCode: resp.statusCode, body: new TextDecoder().decode(resp.body), headers: resp.headers };");
        }
        HttpResponseFormat::Binary => {
            w.line("return { statusCode: resp.statusCode, body: resp.body, headers: resp.headers };");
        }
    }

    w.block_close_semi();
}

fn emit_ai_fetch_fn(fn_name: &str, op: &AiCallOp, w: &mut CodeWriter) {
    w.block_open(&format!(
        "const {} = (sendRequester: HTTPSendRequester, config: Config) =>",
        fn_name
    ));

    let base_url = emit_value_expr_init(&op.base_url);
    let model = emit_value_expr_init(&op.model);
    let system_prompt = emit_value_expr_init(&op.system_prompt);
    let user_prompt = emit_value_expr_init(&op.user_prompt);

    // Build request body
    w.block_open("const body =");
    w.line(&format!("model: {},", model));
    w.line("messages: [");
    w.indent();
    w.line(&format!("{{ role: \"system\", content: {} }},", system_prompt));
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

    w.line("const bodyBytes = new TextEncoder().encode(JSON.stringify(body));");
    w.blank();

    w.block_open("const req =");
    w.line(&format!("url: {},", base_url));
    w.line("method: \"POST\" as const,");
    w.line("body: Buffer.from(bodyBytes).toString(\"base64\"),");
    w.block_open("headers:");
    w.line("\"Content-Type\": \"application/json\",");
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
