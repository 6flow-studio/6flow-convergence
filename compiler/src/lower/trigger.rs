//! Map trigger node config → IR TriggerDef + TriggerParam.

use crate::error::CompilerError;
use crate::ir::types::*;
use crate::parse::types::{WorkflowNode, CronTriggerConfig, HttpTriggerConfig, EvmLogTriggerConfig};

use super::reference::resolve_value_expr;

pub struct TriggerResult {
    pub trigger_def: TriggerDef,
    pub trigger_param: TriggerParam,
    pub evm_chain_for_trigger: Option<(String, String)>,
}

pub fn lower_trigger(
    node: &WorkflowNode,
    config_fields: &mut Vec<ConfigField>,
) -> Result<TriggerResult, Vec<CompilerError>> {
    match node {
        WorkflowNode::CronTrigger(n) => lower_cron_trigger(&n.data.config, config_fields),
        WorkflowNode::HttpTrigger(n) => lower_http_trigger(&n.data.config),
        WorkflowNode::EvmLogTrigger(n) => lower_evm_log_trigger(&n.data.config),
        _ => Err(vec![CompilerError::lower(
            "L002",
            format!("Node '{}' is not a trigger", node.id()),
            Some(node.id().to_string()),
        )]),
    }
}

fn lower_cron_trigger(
    config: &CronTriggerConfig,
    config_fields: &mut Vec<ConfigField>,
) -> Result<TriggerResult, Vec<CompilerError>> {
    // Add schedule to config_schema
    config_fields.push(ConfigField {
        name: "schedule".into(),
        zod_type: ZodType::String,
        default_value: Some(config.schedule.clone()),
        description: Some("Cron schedule (min 30s interval)".into()),
    });

    let schedule = ValueExpr::config("schedule");
    let timezone = config.timezone.as_ref().map(|tz| ValueExpr::string(tz.as_str()));

    Ok(TriggerResult {
        trigger_def: TriggerDef::Cron(CronTriggerDef { schedule, timezone }),
        trigger_param: TriggerParam::CronTrigger,
        evm_chain_for_trigger: None,
    })
}

fn lower_http_trigger(config: &HttpTriggerConfig) -> Result<TriggerResult, Vec<CompilerError>> {
    let path = config.path.as_deref().map(|p| ValueExpr::string(p)).unwrap_or(ValueExpr::string("/"));
    let methods = vec![config.http_method.clone()];

    Ok(TriggerResult {
        trigger_def: TriggerDef::Http(HttpTriggerDef { path, methods }),
        trigger_param: TriggerParam::HttpRequest,
        evm_chain_for_trigger: None,
    })
}

fn lower_evm_log_trigger(config: &EvmLogTriggerConfig) -> Result<TriggerResult, Vec<CompilerError>> {
    let binding_name = make_evm_binding_name(&config.chain_selector_name);

    let contract_addresses: Vec<ValueExpr> = config
        .contract_addresses
        .iter()
        .map(|a| resolve_value_expr(a, &std::collections::HashMap::new()))
        .collect();

    let mut topic_filters = Vec::new();
    if let Some(filters) = &config.topic_filters {
        if let Some(t1) = &filters.topic1 {
            topic_filters.push(TopicFilter { index: 1, values: t1.clone() });
        }
        if let Some(t2) = &filters.topic2 {
            topic_filters.push(TopicFilter { index: 2, values: t2.clone() });
        }
        if let Some(t3) = &filters.topic3 {
            topic_filters.push(TopicFilter { index: 3, values: t3.clone() });
        }
    }

    let confidence = config
        .block_confirmation
        .clone()
        .unwrap_or_else(|| "finalized".to_string());

    let event_abi_json = serde_json::to_string(&config.event_abi).unwrap_or_default();

    Ok(TriggerResult {
        trigger_def: TriggerDef::EvmLog(EvmLogTriggerDef {
            evm_client_binding: binding_name.clone(),
            contract_addresses,
            event_signature: config.event_signature.clone(),
            event_abi_json,
            topic_filters,
            confidence,
        }),
        trigger_param: TriggerParam::EvmLog,
        evm_chain_for_trigger: Some((config.chain_selector_name.clone(), binding_name)),
    })
}

pub fn make_evm_binding_name(chain_selector: &str) -> String {
    let sanitized = chain_selector.replace('-', "_");
    format!("evmClient_{}", sanitized)
}
