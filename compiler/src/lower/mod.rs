//! Lowering phase: Workflow → WorkflowIR.
//!
//! Transforms the parsed visual workflow into the semantic IR consumed by codegen.
//! SYNC NOTE: When node types/configs change in `shared/model/node.ts`,
//! re-check this orchestrator and the lower submodules for full coverage.

pub mod builder;
pub mod expand;
pub mod extract;
pub mod reference;
pub mod topo;
pub mod trigger;

use std::collections::HashMap;

use crate::error::CompilerError;
use crate::ir::types::*;
use crate::parse::graph::WorkflowGraph;
use crate::parse::types::Workflow;

/// Lower a parsed workflow + graph into a WorkflowIR.
pub fn lower(workflow: &Workflow, graph: &WorkflowGraph) -> Result<WorkflowIR, Vec<CompilerError>> {
    // 1. Topological sort (position-aware: topmost then leftmost, matching n8n v1 order)
    let topo_order = topo::topo_sort(graph, workflow)?;

    // 2. Find trigger node
    let trigger_node = workflow
        .nodes
        .iter()
        .find(|n| n.is_trigger())
        .ok_or_else(|| vec![CompilerError::lower("L002", "No trigger node found", None)])?;

    // 3. Build id_map for convenience node expansion + trigger alias
    let mut id_map = build_id_map(workflow);
    // Map trigger node ID (e.g. "trigger-1") → "trigger" so that
    // {{trigger-1.field}} resolves to TriggerDataRef via parse_single_ref.
    id_map.insert(trigger_node.id().to_string(), "trigger".to_string());
    // Also map by label for name-based expressions: {{nodeName.field}}.
    // EVM Log event args are decoded as local consts, so use "evmLogTrigger" to
    // distinguish them from cron/http trigger data (which uses `triggerData.field`).
    let trigger_id_map_target = if trigger_node.node_type() == "evmLogTrigger" {
        "evmLogTrigger"
    } else {
        "trigger"
    };
    id_map.insert(trigger_node.label().to_string(), trigger_id_map_target.to_string());

    // 4. Lower trigger
    let mut config_fields = Vec::new();
    let trigger_result = trigger::lower_trigger(trigger_node, &mut config_fields)?;

    // 5. Extract global resources
    let secrets = extract::extract_secrets(&workflow.global_config);

    let trigger_chain = trigger_result
        .evm_chain_for_trigger
        .as_ref()
        .map(|(s, b)| (s.as_str(), b.as_str()));
    let evm_chains = extract::extract_evm_chains(workflow, trigger_chain);

    // 6. Extract additional config fields from nodes
    extract::extract_config_from_nodes(workflow, &mut config_fields);

    // 7. Build handler body
    let handler_body = builder::build_handler_body(&topo_order, workflow, graph, &id_map)?;

    // 8. Assemble IR
    let ir = WorkflowIR {
        metadata: WorkflowMetadata {
            id: workflow.id.clone(),
            name: workflow.name.clone(),
            description: workflow.description.clone(),
            version: workflow.version.clone(),
            is_testnet: workflow.global_config.is_testnet,
            default_chain_selector: None,
        },
        trigger: trigger_result.trigger_def,
        trigger_param: trigger_result.trigger_param,
        config_schema: config_fields,
        required_secrets: secrets,
        evm_chains,
        user_rpcs: workflow
            .global_config
            .rpcs
            .iter()
            .map(|r| RpcEntry {
                chain_name: r.chain_name.clone(),
                url: r.url.clone(),
            })
            .collect(),
        handler_body,
    };

    Ok(ir)
}

/// Build a mapping from node IDs (and labels) to their resolved step IDs.
///
/// - Convenience nodes: node ID → expanded output step ID
/// - Regular non-trigger nodes: node label → node ID (for name-based `{{nodeName.field}}`)
/// - Trigger nodes: handled in `lower()` after this function (needs trigger type info)
fn build_id_map(workflow: &Workflow) -> HashMap<String, String> {
    let mut map = HashMap::new();

    for node in &workflow.nodes {
        if let Some(output_id) = expand::output_step_id(node) {
            map.insert(node.id().to_string(), output_id.clone());
            // Also map by label for name-based expressions
            map.insert(node.label().to_string(), output_id);
        } else if !node.is_trigger() {
            // Regular (non-trigger) nodes: map label → id for {{nodeName.field}} lookup
            map.insert(node.label().to_string(), node.id().to_string());
        }
    }

    map
}
