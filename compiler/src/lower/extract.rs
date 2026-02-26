//! Extract global resources from the workflow: config_schema, secrets, evm_chains.
//! SYNC NOTE: Node-to-resource extraction matches must stay aligned with
//! node types/configs in `shared/model/node.ts`.

use std::collections::HashSet;

use crate::ir::types::*;
use crate::parse::types::{GlobalConfig, Workflow, WorkflowNode};

use super::trigger::make_evm_binding_name;

/// Extract required secrets from globalConfig.
pub fn extract_secrets(global: &GlobalConfig) -> Vec<SecretDeclaration> {
    global
        .secrets
        .iter()
        .map(|s| SecretDeclaration {
            name: s.name.clone(),
            env_variable: s.env_variable.clone(),
        })
        .collect()
}

/// Extract distinct EVM chains used across all nodes.
/// `trigger_chain` is the chain used by the trigger (if any), which gets `used_for_trigger: true`.
pub fn extract_evm_chains(
    workflow: &Workflow,
    trigger_chain: Option<(&str, &str)>,
) -> Vec<EvmChainUsage> {
    let mut seen = HashSet::new();
    let mut chains = Vec::new();

    // Add trigger chain first if present
    if let Some((selector, binding)) = trigger_chain {
        seen.insert(selector.to_string());
        chains.push(EvmChainUsage {
            chain_selector_name: selector.to_string(),
            binding_name: binding.to_string(),
            used_for_trigger: true,
        });
    }

    for node in &workflow.nodes {
        let chain_selector = get_chain_selector(node);
        if let Some(selector) = chain_selector {
            if seen.insert(selector.clone()) {
                let binding = make_evm_binding_name(&selector);
                chains.push(EvmChainUsage {
                    chain_selector_name: selector,
                    binding_name: binding,
                    used_for_trigger: false,
                });
            }
        }
    }

    chains
}

fn get_chain_selector(node: &WorkflowNode) -> Option<String> {
    match node {
        WorkflowNode::EvmRead(n) => Some(n.data.config.chain_selector_name.clone()),
        WorkflowNode::EvmWrite(n) => Some(n.data.config.chain_selector_name.clone()),
        WorkflowNode::MintToken(n) => Some(n.data.config.chain_selector_name.clone()),
        WorkflowNode::BurnToken(n) => Some(n.data.config.chain_selector_name.clone()),
        WorkflowNode::TransferToken(n) => Some(n.data.config.chain_selector_name.clone()),
        WorkflowNode::CheckBalance(n) => Some(n.data.config.chain_selector_name.clone()),
        _ => None,
    }
}

/// Extract user-configurable fields into config_schema.
/// This is called after trigger config extraction to add fields from specific node patterns.
pub fn extract_config_from_nodes(workflow: &Workflow, existing: &mut Vec<ConfigField>) {
    let existing_names: HashSet<String> = existing.iter().map(|f| f.name.clone()).collect();

    // Walk nodes looking for common patterns that produce config fields.
    // For now, we extract configurable references from certain patterns.
    // In the future this could be driven by node metadata.
    for node in &workflow.nodes {
        match node {
            WorkflowNode::HttpRequest(n) => {
                // URL template references like {{config.walletAddress}} are already handled
                // by the reference parser. We don't auto-generate config fields for them here.
                let _ = n;
            }
            _ => {}
        }
    }

    let _ = existing_names;
}
