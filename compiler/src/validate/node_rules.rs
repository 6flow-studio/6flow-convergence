//! Per-node configuration validation.
//! SYNC NOTE: Match arms here must track `WorkflowNode` in
//! `compiler/src/parse/types.rs` and `shared/model/node.ts`.

use crate::error::CompilerError;
use crate::parse::types::*;

/// Validate a single node's config. Returns all errors found.
pub fn validate_node_config(node: &WorkflowNode, global: &GlobalConfig) -> Vec<CompilerError> {
    let mut errors = Vec::new();
    let node_id = Some(node.id().to_string());

    match node {
        WorkflowNode::CronTrigger(n) => {
            if n.data.config.schedule.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N001",
                    "Cron trigger schedule must not be empty",
                    node_id,
                ));
            }
        }
        WorkflowNode::HttpTrigger(n) => {
            let valid_methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"];
            if !valid_methods.contains(&n.data.config.http_method.as_str()) {
                errors.push(CompilerError::validate(
                    "N002",
                    format!("Invalid HTTP method '{}'", n.data.config.http_method),
                    node_id,
                ));
            }
        }
        WorkflowNode::EvmLogTrigger(n) => {
            if n.data.config.contract_addresses.is_empty() {
                errors.push(CompilerError::validate(
                    "N003",
                    "EVM log trigger must have at least one contract address",
                    node_id.clone(),
                ));
            }
            if n.data.config.contract_addresses.len() > 5 {
                errors.push(CompilerError::validate(
                    "N003",
                    "EVM log trigger cannot have more than 5 contract addresses (CRE limit)",
                    node_id.clone(),
                ));
            }
            if n.data.config.event_signature.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N003",
                    "EVM log trigger event signature must not be empty",
                    node_id,
                ));
            }
        }
        WorkflowNode::HttpRequest(n) => {
            if n.data.config.url.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N004",
                    "HTTP request URL must not be empty",
                    node_id.clone(),
                ));
            }
            let valid_methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"];
            if !valid_methods.contains(&n.data.config.method.as_str()) {
                errors.push(CompilerError::validate(
                    "N004",
                    format!("Invalid HTTP method '{}'", n.data.config.method),
                    node_id.clone(),
                ));
            }
            // Check auth secret references exist
            if let Some(auth) = &n.data.config.authentication {
                validate_http_auth_secrets(auth, global, node.id(), &mut errors);
            }
        }
        WorkflowNode::EvmRead(n) => {
            if n.data.config.contract_address.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N005",
                    "EVM read contract address must not be empty",
                    node_id.clone(),
                ));
            }
            if n.data.config.function_name.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N005",
                    "EVM read function name must not be empty",
                    node_id,
                ));
            }
        }
        WorkflowNode::EvmWrite(n) => {
            if n.data.config.receiver_address.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N006",
                    "EVM write receiver address must not be empty",
                    node_id.clone(),
                ));
            }
            if let Ok(gas) = n.data.config.gas_limit.parse::<u64>() {
                if gas > 5_000_000 {
                    errors.push(CompilerError::validate(
                        "N006",
                        "EVM write gas limit exceeds CRE maximum (5,000,000)",
                        node_id,
                    ));
                }
            }
        }
        WorkflowNode::GetSecret(n) => {
            if n.data.config.secret_name.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N007",
                    "Secret name must not be empty",
                    node_id.clone(),
                ));
            }
            if !global
                .secrets
                .iter()
                .any(|s| s.name == n.data.config.secret_name)
            {
                errors.push(CompilerError::validate(
                    "N007",
                    format!(
                        "Secret '{}' not declared in globalConfig.secrets",
                        n.data.config.secret_name
                    ),
                    node_id,
                ));
            }
        }
        WorkflowNode::CodeNode(n) => {
            if n.data.config.code.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N008",
                    "Code node must have non-empty code",
                    node_id,
                ));
            }
        }
        WorkflowNode::JsonParse(_) => {}
        WorkflowNode::AbiEncode(n) => {
            if n.data.config.abi_params.is_empty() {
                errors.push(CompilerError::validate(
                    "N009",
                    "ABI encode must have at least one parameter",
                    node_id,
                ));
            }
        }
        WorkflowNode::AbiDecode(n) => {
            if n.data.config.abi_params.is_empty() {
                errors.push(CompilerError::validate(
                    "N010",
                    "ABI decode must have at least one parameter",
                    node_id,
                ));
            }
        }
        WorkflowNode::Merge(_) => {}
        WorkflowNode::Filter(n) => {
            if n.data.config.conditions.is_empty() {
                errors.push(CompilerError::validate(
                    "N011",
                    "Filter must have at least one condition",
                    node_id,
                ));
            }
        }
        WorkflowNode::If(n) => {
            if n.data.config.conditions.is_empty() {
                errors.push(CompilerError::validate(
                    "N012",
                    "If node must have at least one condition",
                    node_id,
                ));
            }
        }
        WorkflowNode::Ai(n) => {
            if n.data.config.api_key_secret.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N013",
                    "AI node must have an API key secret",
                    node_id.clone(),
                ));
            }
            if !global
                .secrets
                .iter()
                .any(|s| s.name == n.data.config.api_key_secret)
            {
                errors.push(CompilerError::validate(
                    "N013",
                    format!(
                        "Secret '{}' not declared in globalConfig.secrets",
                        n.data.config.api_key_secret
                    ),
                    node_id,
                ));
            }
        }
        WorkflowNode::Return(n) => {
            if n.data.config.return_expression.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N014",
                    "Return expression must not be empty",
                    node_id,
                ));
            }
        }
        WorkflowNode::Error(n) => {
            if n.data.config.error_message.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N016",
                    "Error message must not be empty",
                    node_id,
                ));
            }
        }
        WorkflowNode::MintToken(n) => {
            if n.data.config.token_contract_address.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N017",
                    "Mint token contract address must not be empty",
                    node_id.clone(),
                ));
            }
            if n.data.config.recipient_source.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N017",
                    "Mint token recipient source must not be empty",
                    node_id,
                ));
            }
        }
        WorkflowNode::BurnToken(n) => {
            if n.data.config.token_contract_address.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N018",
                    "Burn token contract address must not be empty",
                    node_id,
                ));
            }
        }
        WorkflowNode::TransferToken(n) => {
            if n.data.config.token_contract_address.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N019",
                    "Transfer token contract address must not be empty",
                    node_id,
                ));
            }
        }
        WorkflowNode::CheckKyc(n) => {
            if n.data.config.provider_url.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N020",
                    "KYC provider URL must not be empty",
                    node_id.clone(),
                ));
            }
            if !global
                .secrets
                .iter()
                .any(|s| s.name == n.data.config.api_key_secret_name)
            {
                errors.push(CompilerError::validate(
                    "N020",
                    format!(
                        "Secret '{}' not declared in globalConfig.secrets",
                        n.data.config.api_key_secret_name
                    ),
                    node_id,
                ));
            }
        }
        WorkflowNode::CheckBalance(n) => {
            if n.data.config.token_contract_address.trim().is_empty() {
                errors.push(CompilerError::validate(
                    "N021",
                    "Check balance token contract address must not be empty",
                    node_id,
                ));
            }
        }
    }

    errors
}

fn validate_http_auth_secrets(
    auth: &HttpAuthConfig,
    global: &GlobalConfig,
    node_id: &str,
    errors: &mut Vec<CompilerError>,
) {
    let secret_names: Vec<&str> = match auth {
        HttpAuthConfig::None => vec![],
        HttpAuthConfig::BearerToken { token_secret } => vec![token_secret.as_str()],
    };

    for name in secret_names {
        if !global.secrets.iter().any(|s| s.name == name) {
            errors.push(CompilerError::validate(
                "N004",
                format!(
                    "HTTP auth references secret '{}' not declared in globalConfig.secrets",
                    name
                ),
                Some(node_id.to_string()),
            ));
        }
    }
}
