//! Step sequence builder: walk topo-sorted nodes, expand convenience nodes,
//! detect branch/merge patterns, build IR Block/Step structures.
//! SYNC NOTE: `lower_node` and branch handling matches must be updated when
//! node types/configs change in `shared/model/node.ts`.

use std::collections::{HashMap, HashSet};

use crate::error::CompilerError;
use crate::ir::types::*;
use crate::parse::types::{WorkflowNode, Workflow};
use crate::parse::graph::WorkflowGraph;

use super::expand::{self, ExpandedStep};
use super::reference::resolve_value_expr;

/// Build the handler body from a topo-sorted list of node IDs.
pub fn build_handler_body(
    topo_order: &[String],
    workflow: &Workflow,
    graph: &WorkflowGraph,
    id_map: &HashMap<String, String>,
) -> Result<Block, Vec<CompilerError>> {
    let node_map: HashMap<&str, &WorkflowNode> = workflow
        .nodes
        .iter()
        .map(|n| (n.id(), n))
        .collect();

    // Skip trigger node
    let non_trigger: Vec<&str> = topo_order
        .iter()
        .filter(|id| {
            node_map
                .get(id.as_str())
                .map(|n| !n.is_trigger())
                .unwrap_or(false)
        })
        .map(|s| s.as_str())
        .collect();

    let mut consumed = HashSet::new();
    let steps = build_steps(&non_trigger, &node_map, graph, id_map, &mut consumed)?;

    Ok(Block { steps })
}

fn build_steps(
    node_ids: &[&str],
    node_map: &HashMap<&str, &WorkflowNode>,
    graph: &WorkflowGraph,
    id_map: &HashMap<String, String>,
    consumed: &mut HashSet<String>,
) -> Result<Vec<Step>, Vec<CompilerError>> {
    let mut steps = Vec::new();
    let mut errors = Vec::new();
    let mut i = 0;

    while i < node_ids.len() {
        let node_id = node_ids[i];

        if consumed.contains(node_id) {
            i += 1;
            continue;
        }

        let Some(node) = node_map.get(node_id) else {
            i += 1;
            continue;
        };

        consumed.insert(node_id.to_string());

        match node {
            WorkflowNode::If(n) => {
                // Build branch structure
                match build_branch(node_id, &n.data.config, node_ids, node_map, graph, id_map, consumed) {
                    Ok(branch_steps) => steps.extend(branch_steps),
                    Err(e) => errors.extend(e),
                }
            }
            _ => {
                // Check if it's a convenience node
                if let Some(expanded) = expand::expand_node(node, id_map) {
                    for es in expanded {
                        steps.push(expanded_to_step(es));
                    }
                } else {
                    match lower_node(node, graph, node_map, id_map) {
                        Ok(step) => steps.push(step),
                        Err(e) => errors.extend(e),
                    }
                }

                // Expand settings.log: append a LogOp step after the node
                if let Some(settings) = node.settings() {
                    if let Some(log) = &settings.log {
                        let level = match log.level.as_str() {
                            "debug" => LogLevel::Debug,
                            "warn" => LogLevel::Warn,
                            "error" => LogLevel::Error,
                            _ => LogLevel::Info,
                        };
                        steps.push(Step {
                            id: format!("{}___log", node_id),
                            source_node_ids: vec![node_id.to_string()],
                            label: format!("Log ({})", node.label()),
                            operation: Operation::Log(LogOp {
                                level,
                                message: resolve_value_expr(&log.message_template, id_map),
                            }),
                            output: None,
                        });
                    }
                }

                // Auto-return for leaf nodes: if no outgoing edges and not an explicit
                // terminal node, append a ReturnOp
                let is_leaf = graph.outgoing_edges(node_id).is_empty();
                let is_terminal = node.is_explicit_terminal();
                if is_leaf && !is_terminal {
                    let return_expr = node
                        .settings()
                        .and_then(|s| s.return_expression.as_deref())
                        .unwrap_or("\"ok\"");
                    steps.push(Step {
                        id: format!("{}___auto_return", node_id),
                        source_node_ids: vec![node_id.to_string()],
                        label: "Auto return".into(),
                        operation: Operation::Return(ReturnOp {
                            expression: resolve_value_expr(return_expr, id_map),
                        }),
                        output: None,
                    });
                }
            }
        }

        i += 1;
    }

    if !errors.is_empty() {
        return Err(errors);
    }

    Ok(steps)
}

fn build_branch(
    if_node_id: &str,
    if_config: &crate::parse::types::IfConfig,
    all_node_ids: &[&str],
    node_map: &HashMap<&str, &WorkflowNode>,
    graph: &WorkflowGraph,
    id_map: &HashMap<String, String>,
    consumed: &mut HashSet<String>,
) -> Result<Vec<Step>, Vec<CompilerError>> {
    let mut result_steps = Vec::new();

    // Get true/false successors from graph edges
    let edges = graph.outgoing_edges(if_node_id);
    let mut true_target = None;
    let mut false_target = None;

    for (target, label) in &edges {
        match label.source_handle.as_deref() {
            Some("true") => true_target = Some(*target),
            Some("false") => false_target = Some(*target),
            _ => {}
        }
    }

    let true_target = true_target.unwrap_or("");
    let false_target = false_target.unwrap_or("");

    // Find the merge/reconvergence point: the first node reachable from both branches.
    let merge_node_id = find_reconvergence(if_node_id, true_target, false_target, all_node_ids, graph);

    // Collect nodes in each branch (between if and merge)
    let true_nodes = collect_branch_nodes(true_target, merge_node_id.as_deref(), all_node_ids, graph, consumed);
    let false_nodes = collect_branch_nodes(false_target, merge_node_id.as_deref(), all_node_ids, graph, consumed);

    // Build true branch steps
    let true_refs: Vec<&str> = true_nodes.iter().map(|s| s.as_str()).collect();
    let true_steps = build_steps(&true_refs, node_map, graph, id_map, consumed)?;
    let true_block = Block { steps: true_steps };

    // Build false branch steps
    let false_refs: Vec<&str> = false_nodes.iter().map(|s| s.as_str()).collect();
    let false_steps = build_steps(&false_refs, node_map, graph, id_map, consumed)?;
    let false_block = Block { steps: false_steps };

    // Build conditions
    let conditions: Vec<ConditionIR> = if_config
        .conditions
        .iter()
        .map(|c| {
            let field = resolve_value_expr(&c.field, id_map);
            let value = c.value.as_ref().map(|v| resolve_value_expr(v, id_map));
            let operator = parse_comparison_op(&c.operator);
            ConditionIR { field, operator, value }
        })
        .collect();

    let combine_with = if if_config.combine_with == "or" {
        LogicCombinator::Or
    } else {
        LogicCombinator::And
    };

    let reconverge_at = merge_node_id.clone();

    let branch_step = Step {
        id: if_node_id.to_string(),
        source_node_ids: vec![if_node_id.to_string()],
        label: node_map
            .get(if_node_id)
            .map(|n| n.label().to_string())
            .unwrap_or_else(|| if_node_id.to_string()),
        operation: Operation::Branch(BranchOp {
            conditions,
            combine_with,
            true_branch: true_block,
            false_branch: false_block,
            reconverge_at: reconverge_at.clone(),
        }),
        output: None,
    };

    result_steps.push(branch_step);

    // Build merge step if there's a reconvergence point
    if let Some(merge_id) = &reconverge_at {
        consumed.insert(merge_id.clone());

        // Determine merge inputs from the last step of each branch
        let merge_step = Step {
            id: merge_id.clone(),
            source_node_ids: vec![merge_id.clone()],
            label: node_map
                .get(merge_id.as_str())
                .map(|n| n.label().to_string())
                .unwrap_or_else(|| merge_id.clone()),
            operation: Operation::Merge(MergeOp {
                branch_step_id: if_node_id.to_string(),
                strategy: MergeStrategy::PassThrough,
                inputs: vec![
                    MergeInput {
                        handle_name: "true".into(),
                        value: ValueExpr::raw("/* true branch result */"),
                    },
                    MergeInput {
                        handle_name: "false".into(),
                        value: ValueExpr::raw("/* false branch result */"),
                    },
                ],
            }),
            output: Some(OutputBinding {
                variable_name: format!("step_{}", merge_id.replace('-', "_")),
                ts_type: "any".into(),
                destructure_fields: None,
            }),
        };

        result_steps.push(merge_step);
    }

    Ok(result_steps)
}

/// Find the reconvergence point (merge node) for a branch.
/// This is the first node in topo order that is reachable from both true and false targets.
fn find_reconvergence(
    _if_node_id: &str,
    true_target: &str,
    false_target: &str,
    all_node_ids: &[&str],
    graph: &WorkflowGraph,
) -> Option<String> {
    if true_target.is_empty() || false_target.is_empty() {
        return None;
    }

    // Collect all reachable nodes from each branch
    let true_reachable = collect_reachable(true_target, graph);
    let false_reachable = collect_reachable(false_target, graph);

    // Find the first node in topo order reachable from both
    for node_id in all_node_ids {
        if true_reachable.contains(*node_id) && false_reachable.contains(*node_id) {
            return Some(node_id.to_string());
        }
    }

    None
}

fn collect_reachable(start: &str, graph: &WorkflowGraph) -> HashSet<String> {
    let mut reachable = HashSet::new();
    let mut queue = vec![start.to_string()];

    while let Some(node_id) = queue.pop() {
        if reachable.insert(node_id.clone()) {
            for (succ, _) in graph.successors(&node_id) {
                queue.push(succ.to_string());
            }
        }
    }

    reachable
}

/// Collect nodes belonging to a branch (between branch target and merge point).
fn collect_branch_nodes(
    start: &str,
    merge_id: Option<&str>,
    all_node_ids: &[&str],
    graph: &WorkflowGraph,
    consumed: &HashSet<String>,
) -> Vec<String> {
    if start.is_empty() {
        return vec![];
    }

    let reachable = collect_reachable(start, graph);
    let mut branch_nodes = Vec::new();

    // Walk in topo order, collecting nodes that are reachable from start
    // but stop at merge point
    for node_id in all_node_ids {
        if consumed.contains(*node_id) {
            continue;
        }
        if Some(*node_id) == merge_id {
            continue;
        }
        if reachable.contains(*node_id) {
            branch_nodes.push(node_id.to_string());
        }
    }

    branch_nodes
}

fn expanded_to_step(es: ExpandedStep) -> Step {
    Step {
        id: es.id,
        source_node_ids: vec![es.source_node_id],
        label: es.label,
        operation: es.operation,
        output: es.output,
    }
}

/// Resolve the input for a node that implicitly consumes its graph predecessor's output.
/// `http_field` is used when the predecessor is HttpRequest (e.g. "body"),
/// `default_field` is used for all other predecessor types.
fn resolve_predecessor_input(
    node_id: &str,
    http_field: &str,
    default_field: &str,
    graph: &WorkflowGraph,
    node_map: &HashMap<&str, &WorkflowNode>,
    id_map: &HashMap<String, String>,
) -> ValueExpr {
    let preds = graph.predecessors(node_id);
    let Some(pred_id) = preds.first() else {
        return ValueExpr::raw("/* no predecessor */");
    };

    // If predecessor is a trigger node, reference triggerData instead of a step binding
    if let Some(pred_node) = node_map.get(*pred_id) {
        match pred_node.node_type() {
            "cronTrigger" | "httpTrigger" | "evmLogTrigger" => {
                let field = match pred_node.node_type() {
                    "httpTrigger" => "input",
                    _ => if default_field.is_empty() { "input" } else { default_field },
                };
                return ValueExpr::trigger_data(field);
            }
            _ => {}
        }
    }

    // Resolve through id_map in case predecessor was a convenience node
    let step_id = id_map.get(*pred_id).cloned().unwrap_or_else(|| pred_id.to_string());

    let field = match node_map.get(*pred_id).map(|n| n.node_type()) {
        Some("httpRequest") | Some("ai") => http_field,
        _ => default_field,
    };

    ValueExpr::binding(step_id, field)
}

/// Lower a non-convenience, non-trigger, non-if node to a Step.
fn lower_node(
    node: &WorkflowNode,
    graph: &WorkflowGraph,
    node_map: &HashMap<&str, &WorkflowNode>,
    id_map: &HashMap<String, String>,
) -> Result<Step, Vec<CompilerError>> {
    let node_id = node.id();
    let label = node.label().to_string();

    let (operation, output) = match node {
        WorkflowNode::HttpRequest(n) => lower_http_request(node_id, &n.data.config, id_map),
        WorkflowNode::EvmRead(n) => lower_evm_read(node_id, &n.data.config, id_map),
        WorkflowNode::EvmWrite(n) => lower_evm_write(node_id, &n.data.config, id_map),
        WorkflowNode::GetSecret(n) => lower_get_secret(node_id, &n.data.config),
        WorkflowNode::CodeNode(n) => lower_code_node(node_id, &n.data.config, id_map),
        WorkflowNode::JsonParse(n) => lower_json_parse(node_id, &n.data.config, graph, node_map, id_map),
        WorkflowNode::AbiEncode(n) => lower_abi_encode(node_id, &n.data.config, id_map),
        WorkflowNode::AbiDecode(n) => lower_abi_decode(node_id, &n.data.config, graph, node_map, id_map),
        WorkflowNode::Filter(n) => lower_filter(node_id, &n.data.config, id_map),
        WorkflowNode::Ai(n) => lower_ai(node_id, &n.data.config, id_map),
        WorkflowNode::Log(n) => lower_log(node_id, &n.data.config, id_map),
        WorkflowNode::Error(n) => lower_error(node_id, &n.data.config, id_map),
        WorkflowNode::StopAndError(n) => lower_stop_and_error(node_id, &n.data.config, id_map),
        WorkflowNode::Return(n) => lower_return(node_id, &n.data.config, id_map),
        WorkflowNode::Merge(n) => lower_merge_standalone(node_id, &n.data.config),
        _ => {
            return Err(vec![CompilerError::lower(
                "L003",
                format!("Unsupported node type '{}' for direct lowering", node.node_type()),
                Some(node_id.to_string()),
            )]);
        }
    };

    Ok(Step {
        id: node_id.to_string(),
        source_node_ids: vec![node_id.to_string()],
        label,
        operation,
        output,
    })
}

// ---------------------------------------------------------------------------
// Individual node lowering functions
// ---------------------------------------------------------------------------

fn lower_http_request(
    node_id: &str,
    config: &crate::parse::types::HttpRequestConfig,
    id_map: &HashMap<String, String>,
) -> (Operation, Option<OutputBinding>) {
    let method = match config.method.to_uppercase().as_str() {
        "GET" => HttpMethod::Get,
        "POST" => HttpMethod::Post,
        "PUT" => HttpMethod::Put,
        "DELETE" => HttpMethod::Delete,
        "PATCH" => HttpMethod::Patch,
        "HEAD" => HttpMethod::Head,
        _ => HttpMethod::Get,
    };

    let url = resolve_value_expr(&config.url, id_map);

    let headers: Vec<(String, ValueExpr)> = config
        .headers
        .as_ref()
        .map(|h| {
            h.iter()
                .map(|(k, v)| (k.clone(), resolve_value_expr(v, id_map)))
                .collect()
        })
        .unwrap_or_default();

    let query_params: Vec<(String, ValueExpr)> = config
        .query_parameters
        .as_ref()
        .map(|q| {
            q.iter()
                .map(|(k, v)| (k.clone(), resolve_value_expr(v, id_map)))
                .collect()
        })
        .unwrap_or_default();

    let body = config.body.as_ref().map(|b| {
        let content_type = match b.content_type.as_str() {
            "json" => HttpContentType::Json,
            "formUrlEncoded" => HttpContentType::FormUrlEncoded,
            _ => HttpContentType::Raw,
        };
        HttpBody {
            content_type,
            data: resolve_value_expr(&b.data, id_map),
        }
    });

    let authentication = config.authentication.as_ref().and_then(|auth| match auth {
        crate::parse::types::HttpAuthConfig::BearerToken { token_secret } => {
            Some(HttpAuth {
                token_secret: token_secret.clone(),
            })
        }
        _ => None, // Only BearerToken is supported
    });

    let response_format = match config.response_format.as_deref() {
        Some("text") => HttpResponseFormat::Text,
        Some("binary") => HttpResponseFormat::Binary,
        _ => HttpResponseFormat::Json,
    };

    let op = Operation::HttpRequest(HttpRequestOp {
        method,
        url,
        headers,
        query_params,
        body,
        authentication,
        cache_max_age_seconds: config.cache_max_age,
        timeout_ms: config.timeout,
        expected_status_codes: config.expected_status_codes.clone().unwrap_or_else(|| vec![200]),
        response_format,
        consensus: ConsensusStrategy::Identical,
    });

    let output = Some(OutputBinding {
        variable_name: format!("step_{}", node_id.replace('-', "_")),
        ts_type: "{ statusCode: number; body: string; headers: Record<string, string> }".into(),
        destructure_fields: None,
    });

    (op, output)
}

fn lower_evm_read(
    node_id: &str,
    config: &crate::parse::types::EvmReadConfig,
    id_map: &HashMap<String, String>,
) -> (Operation, Option<OutputBinding>) {
    use super::trigger::make_evm_binding_name;

    let binding_name = make_evm_binding_name(&config.chain_selector_name);
    let abi_json = serde_json::to_string(&config.abi).unwrap_or_default();

    let args: Vec<EvmArg> = config
        .args
        .iter()
        .map(|a| EvmArg {
            abi_type: a.abi_type.clone(),
            value: resolve_value_expr(&a.value, id_map),
        })
        .collect();

    let op = Operation::EvmRead(EvmReadOp {
        evm_client_binding: binding_name,
        contract_address: resolve_value_expr(&config.contract_address, id_map),
        function_name: config.function_name.clone(),
        abi_json,
        args,
        from_address: config.from_address.as_ref().map(|a| resolve_value_expr(a, id_map)),
        block_number: config.block_number.as_ref().map(|b| resolve_value_expr(b, id_map)),
    });

    let output = Some(OutputBinding {
        variable_name: format!("step_{}", node_id.replace('-', "_")),
        ts_type: "any".into(),
        destructure_fields: None,
    });

    (op, output)
}

fn lower_evm_write(
    node_id: &str,
    config: &crate::parse::types::EvmWriteConfig,
    id_map: &HashMap<String, String>,
) -> (Operation, Option<OutputBinding>) {
    use super::trigger::make_evm_binding_name;

    let binding_name = make_evm_binding_name(&config.chain_selector_name);
    let gas_limit: i64 = config.gas_limit.parse().unwrap_or(500_000);

    // For EvmWrite, the data needs to be pre-encoded. The dataMapping provides
    // the raw args, but we need an ABI encode step. For a standalone EvmWrite node,
    // the user is expected to have an AbiEncode node upstream providing encoded data.
    // We use the first data mapping reference as the encoded_data source.
    let encoded_data = if let Some(first) = config.data_mapping.first() {
        resolve_value_expr(&first.value, id_map)
    } else {
        ValueExpr::raw("/* no data mapping */")
    };

    let op = Operation::EvmWrite(EvmWriteOp {
        evm_client_binding: binding_name,
        receiver_address: resolve_value_expr(&config.receiver_address, id_map),
        gas_limit: ValueExpr::integer(gas_limit),
        encoded_data,
        value_wei: config.value.as_ref().map(|v| resolve_value_expr(v, id_map)),
    });

    let output = Some(OutputBinding {
        variable_name: format!("step_{}", node_id.replace('-', "_")),
        ts_type: "{ txHash: string; status: string }".into(),
        destructure_fields: None,
    });

    (op, output)
}

fn lower_get_secret(
    node_id: &str,
    config: &crate::parse::types::GetSecretConfig,
) -> (Operation, Option<OutputBinding>) {
    let op = Operation::GetSecret(GetSecretOp {
        secret_name: config.secret_name.clone(),
    });

    let output = Some(OutputBinding {
        variable_name: format!("step_{}", node_id.replace('-', "_")),
        ts_type: "{ value: string }".into(),
        destructure_fields: None,
    });

    (op, output)
}

fn lower_code_node(
    node_id: &str,
    config: &crate::parse::types::CodeNodeConfig,
    id_map: &HashMap<String, String>,
) -> (Operation, Option<OutputBinding>) {
    let input_bindings: Vec<CodeInputBinding> = config
        .input_variables
        .iter()
        .map(|var| {
            // Input variables reference previous step outputs
            let value = resolve_value_expr(var, id_map);
            CodeInputBinding {
                variable_name: var.replace("{{", "").replace("}}", "").replace('.', "_"),
                value,
            }
        })
        .collect();

    let execution_mode = if config.execution_mode == "runOnceForEach" {
        CodeExecutionMode::RunOnceForEach
    } else {
        CodeExecutionMode::RunOnceForAll
    };

    let op = Operation::CodeNode(CodeNodeOp {
        code: config.code.clone(),
        input_bindings,
        execution_mode,
        timeout_ms: config.timeout,
    });

    let output = Some(OutputBinding {
        variable_name: format!("step_{}", node_id.replace('-', "_")),
        ts_type: "any".into(),
        destructure_fields: None,
    });

    (op, output)
}

fn lower_json_parse(
    node_id: &str,
    config: &crate::parse::types::JsonParseConfig,
    graph: &WorkflowGraph,
    node_map: &HashMap<&str, &WorkflowNode>,
    id_map: &HashMap<String, String>,
) -> (Operation, Option<OutputBinding>) {
    let input = resolve_predecessor_input(node_id, "body", "", graph, node_map, id_map);
    let op = Operation::JsonParse(JsonParseOp {
        input,
        source_path: config.source_path.clone(),
        strict: config.strict.unwrap_or(true),
    });

    let output = Some(OutputBinding {
        variable_name: format!("step_{}", node_id.replace('-', "_")),
        ts_type: "any".into(),
        destructure_fields: None,
    });

    (op, output)
}

fn lower_abi_encode(
    node_id: &str,
    config: &crate::parse::types::AbiEncodeConfig,
    id_map: &HashMap<String, String>,
) -> (Operation, Option<OutputBinding>) {
    let abi_json = serde_json::to_string(&config.abi_params).unwrap_or_default();

    let data_mappings: Vec<AbiDataMapping> = config
        .data_mapping
        .iter()
        .map(|m| AbiDataMapping {
            param_name: m.param_name.clone(),
            value: resolve_value_expr(&m.source, id_map),
        })
        .collect();

    let op = Operation::AbiEncode(AbiEncodeOp {
        function_name: None,
        abi_json,
        data_mappings,
    });

    let output = Some(OutputBinding {
        variable_name: format!("step_{}", node_id.replace('-', "_")),
        ts_type: "{ encoded: string }".into(),
        destructure_fields: None,
    });

    (op, output)
}

fn lower_abi_decode(
    node_id: &str,
    config: &crate::parse::types::AbiDecodeConfig,
    graph: &WorkflowGraph,
    node_map: &HashMap<&str, &WorkflowNode>,
    id_map: &HashMap<String, String>,
) -> (Operation, Option<OutputBinding>) {
    let abi_json = serde_json::to_string(&config.abi_params).unwrap_or_default();
    let input = resolve_predecessor_input(node_id, "", "", graph, node_map, id_map);

    let op = Operation::AbiDecode(AbiDecodeOp {
        input,
        abi_json,
        output_names: config.output_names.clone(),
    });

    let output = Some(OutputBinding {
        variable_name: format!("step_{}", node_id.replace('-', "_")),
        ts_type: "any".into(),
        destructure_fields: None,
    });

    (op, output)
}

fn lower_filter(
    _node_id: &str,
    config: &crate::parse::types::FilterConfig,
    id_map: &HashMap<String, String>,
) -> (Operation, Option<OutputBinding>) {
    let conditions: Vec<ConditionIR> = config
        .conditions
        .iter()
        .map(|c| {
            let field = resolve_value_expr(&c.field, id_map);
            let value = c.value.as_ref().map(|v| resolve_value_expr(v, id_map));
            let operator = parse_comparison_op(&c.operator);
            ConditionIR { field, operator, value }
        })
        .collect();

    let combine_with = if config.combine_with == "or" {
        LogicCombinator::Or
    } else {
        LogicCombinator::And
    };

    let op = Operation::Filter(FilterOp {
        conditions,
        combine_with,
        non_match_behavior: FilterNonMatchBehavior::EarlyReturn {
            message: "Filter condition not met".into(),
        },
    });

    (op, None)
}

fn lower_ai(
    node_id: &str,
    config: &crate::parse::types::AiNodeConfig,
    id_map: &HashMap<String, String>,
) -> (Operation, Option<OutputBinding>) {
    let response_format = match config.response_format.as_deref() {
        Some("json") => AiResponseFormat::Json,
        _ => AiResponseFormat::Text,
    };

    let op = Operation::AiCall(AiCallOp {
        provider: config.provider.clone(),
        base_url: resolve_value_expr(&config.base_url, id_map),
        model: resolve_value_expr(&config.model, id_map),
        api_key_secret: config.api_key_secret.clone(),
        system_prompt: resolve_value_expr(&config.system_prompt, id_map),
        user_prompt: resolve_value_expr(&config.user_prompt, id_map),
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        response_format,
        consensus: ConsensusStrategy::Identical,
    });

    let output = Some(OutputBinding {
        variable_name: format!("step_{}", node_id.replace('-', "_")),
        ts_type: "any".into(),
        destructure_fields: None,
    });

    (op, output)
}

fn lower_log(
    _node_id: &str,
    config: &crate::parse::types::LogConfig,
    id_map: &HashMap<String, String>,
) -> (Operation, Option<OutputBinding>) {
    let level = match config.level.as_str() {
        "debug" => LogLevel::Debug,
        "warn" => LogLevel::Warn,
        "error" => LogLevel::Error,
        _ => LogLevel::Info,
    };

    let op = Operation::Log(LogOp {
        level,
        message: resolve_value_expr(&config.message_template, id_map),
    });

    (op, None)
}

fn lower_error(
    _node_id: &str,
    config: &crate::parse::types::ErrorConfig,
    id_map: &HashMap<String, String>,
) -> (Operation, Option<OutputBinding>) {
    let op = Operation::ErrorThrow(ErrorThrowOp {
        message: resolve_value_expr(&config.error_message, id_map),
    });

    (op, None)
}

fn lower_stop_and_error(
    _node_id: &str,
    config: &crate::parse::types::StopAndErrorConfig,
    id_map: &HashMap<String, String>,
) -> (Operation, Option<OutputBinding>) {
    let op = Operation::ErrorThrow(ErrorThrowOp {
        message: resolve_value_expr(&config.error_message, id_map),
    });

    (op, None)
}

fn lower_return(
    _node_id: &str,
    config: &crate::parse::types::ReturnConfig,
    id_map: &HashMap<String, String>,
) -> (Operation, Option<OutputBinding>) {
    let op = Operation::Return(ReturnOp {
        expression: resolve_value_expr(&config.return_expression, id_map),
    });

    (op, None)
}

fn lower_merge_standalone(
    node_id: &str,
    _config: &crate::parse::types::MergeConfig,
) -> (Operation, Option<OutputBinding>) {
    // Standalone merge nodes (not paired with an if-branch) are treated as pass-through.
    // The branch builder handles if-associated merges.
    let op = Operation::Merge(MergeOp {
        branch_step_id: "unknown".into(),
        strategy: MergeStrategy::PassThrough,
        inputs: vec![],
    });

    let output = Some(OutputBinding {
        variable_name: format!("step_{}", node_id.replace('-', "_")),
        ts_type: "any".into(),
        destructure_fields: None,
    });

    (op, output)
}

fn parse_comparison_op(op: &str) -> ComparisonOp {
    match op {
        "equals" => ComparisonOp::Equals,
        "notEquals" => ComparisonOp::NotEquals,
        "gt" => ComparisonOp::Gt,
        "gte" => ComparisonOp::Gte,
        "lt" => ComparisonOp::Lt,
        "lte" => ComparisonOp::Lte,
        "contains" => ComparisonOp::Contains,
        "notContains" => ComparisonOp::NotContains,
        "startsWith" => ComparisonOp::StartsWith,
        "endsWith" => ComparisonOp::EndsWith,
        "regex" => ComparisonOp::Regex,
        "notRegex" => ComparisonOp::NotRegex,
        "exists" => ComparisonOp::Exists,
        "notExists" => ComparisonOp::NotExists,
        "isEmpty" => ComparisonOp::IsEmpty,
        "isNotEmpty" => ComparisonOp::IsNotEmpty,
        _ => ComparisonOp::Equals,
    }
}
