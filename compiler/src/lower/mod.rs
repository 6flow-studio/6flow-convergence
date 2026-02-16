//! Lowering phase: Workflow → WorkflowIR.
//!
//! Transforms the parsed visual workflow into the semantic IR consumed by codegen.
//! SYNC NOTE: When node types/configs change in `shared/model/node.ts`,
//! re-check this orchestrator and the lower submodules for full coverage.

pub mod topo;
pub mod trigger;
pub mod extract;
pub mod expand;
pub mod reference;
pub mod builder;

use std::collections::HashMap;

use crate::error::CompilerError;
use crate::ir::types::*;
use crate::parse::types::Workflow;
use crate::parse::graph::WorkflowGraph;

/// Lower a parsed workflow + graph into a WorkflowIR.
pub fn lower(workflow: &Workflow, graph: &WorkflowGraph) -> Result<WorkflowIR, Vec<CompilerError>> {
    // 1. Topological sort
    let topo_order = topo::topo_sort(graph)?;

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
            default_chain_selector: if workflow.global_config.default_chain_selector.is_empty() {
                None
            } else {
                Some(workflow.global_config.default_chain_selector.clone())
            },
        },
        trigger: trigger_result.trigger_def,
        trigger_param: trigger_result.trigger_param,
        config_schema: config_fields,
        required_secrets: secrets,
        evm_chains,
        user_rpcs: workflow.global_config.rpcs
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

/// Build a mapping from original convenience node IDs to their "output" step IDs.
fn build_id_map(workflow: &Workflow) -> HashMap<String, String> {
    let mut map = HashMap::new();

    for node in &workflow.nodes {
        if let Some(output_id) = expand::output_step_id(node) {
            map.insert(node.id().to_string(), output_id);
        }
    }

    map
}
