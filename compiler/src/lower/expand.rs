//! Convenience node expansion: sugar nodes → primitive CRE steps.
//!
//! Expansion happens BEFORE step building. Each convenience node becomes
//! multiple primitive nodes using the `{nodeId}___sub` ID convention.
//! SYNC NOTE: Convenience-node mappings here must track node types/configs in
//! `shared/model/node.ts` and `compiler/src/parse/types.rs`.

use std::collections::HashMap;

use crate::ir::types::*;
use crate::parse::types::*;

use super::reference::resolve_value_expr;
use super::trigger::make_evm_binding_name;

/// An expanded step ready for the builder.
pub struct ExpandedStep {
    pub id: String,
    pub source_node_id: String,
    pub label: String,
    pub operation: Operation,
    pub output: Option<OutputBinding>,
}

/// Expand a convenience node into primitive steps.
/// Returns None if the node is not a convenience node.
pub fn expand_node(
    node: &WorkflowNode,
    id_map: &HashMap<String, String>,
) -> Option<Vec<ExpandedStep>> {
    match node {
        WorkflowNode::MintToken(n) => Some(expand_mint_token(&n.id, &n.data.config, id_map)),
        WorkflowNode::BurnToken(n) => Some(expand_burn_token(&n.id, &n.data.config, id_map)),
        WorkflowNode::TransferToken(n) => Some(expand_transfer_token(&n.id, &n.data.config, id_map)),
        WorkflowNode::CheckKyc(n) => Some(expand_check_kyc(&n.id, &n.data.config, id_map)),
        WorkflowNode::CheckBalance(n) => Some(expand_check_balance(&n.id, &n.data.config, id_map)),
        _ => None,
    }
}

/// Returns the "output" step ID for a convenience node (the last expanded step).
/// This is used so downstream references like `{{mint-1.txHash}}` resolve to the right step.
pub fn output_step_id(node: &WorkflowNode) -> Option<String> {
    match node {
        WorkflowNode::MintToken(n) => Some(format!("{}___write", n.id)),
        WorkflowNode::BurnToken(n) => Some(format!("{}___write", n.id)),
        WorkflowNode::TransferToken(n) => Some(format!("{}___write", n.id)),
        WorkflowNode::CheckKyc(n) => Some(format!("{}___parse", n.id)),
        WorkflowNode::CheckBalance(_) => None, // checkBalance maps to a single evmRead, no rename
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// mintToken → AbiEncode + EvmWrite
// ---------------------------------------------------------------------------

fn expand_mint_token(
    node_id: &str,
    config: &MintTokenConfig,
    id_map: &HashMap<String, String>,
) -> Vec<ExpandedStep> {
    let encode_id = format!("{}___encode", node_id);
    let write_id = format!("{}___write", node_id);
    let binding_name = make_evm_binding_name(&config.chain_selector_name);

    let abi_params_json = serde_json::to_string(&config.token_abi.inputs).unwrap_or_default();

    let encode = ExpandedStep {
        id: encode_id.clone(),
        source_node_id: node_id.to_string(),
        label: format!("ABI encode mint call"),
        operation: Operation::AbiEncode(AbiEncodeOp {
            abi_params_json,
            data_mappings: vec![
                AbiDataMapping {
                    param_name: config.token_abi.inputs.first().map(|i| i.name.clone()).unwrap_or("to".into()),
                    value: resolve_value_expr(&config.recipient_source, id_map),
                },
                AbiDataMapping {
                    param_name: config.token_abi.inputs.get(1).map(|i| i.name.clone()).unwrap_or("amount".into()),
                    value: resolve_value_expr(&config.amount_source, id_map),
                },
            ],
        }),
        output: Some(OutputBinding {
            variable_name: format!("step_{}", encode_id.replace('-', "_")),
            ts_type: "{ encoded: string }".into(),
            destructure_fields: None,
        }),
    };

    let gas_limit: i64 = config.gas_limit.parse().unwrap_or(500_000);

    let write = ExpandedStep {
        id: write_id.clone(),
        source_node_id: node_id.to_string(),
        label: "Execute mint transaction".into(),
        operation: Operation::EvmWrite(EvmWriteOp {
            evm_client_binding: binding_name,
            receiver_address: ValueExpr::string(&config.token_contract_address),
            gas_limit: ValueExpr::integer(gas_limit),
            encoded_data: ValueExpr::binding(&encode_id, "encoded"),
            value_wei: None,
        }),
        output: Some(OutputBinding {
            variable_name: format!("step_{}", write_id.replace('-', "_")),
            ts_type: "{ txHash: string; status: string }".into(),
            destructure_fields: None,
        }),
    };

    vec![encode, write]
}

// ---------------------------------------------------------------------------
// burnToken → AbiEncode + EvmWrite
// ---------------------------------------------------------------------------

fn expand_burn_token(
    node_id: &str,
    config: &BurnTokenConfig,
    id_map: &HashMap<String, String>,
) -> Vec<ExpandedStep> {
    let encode_id = format!("{}___encode", node_id);
    let write_id = format!("{}___write", node_id);
    let binding_name = make_evm_binding_name(&config.chain_selector_name);

    let abi_params_json = serde_json::to_string(&config.token_abi.inputs).unwrap_or_default();

    let encode = ExpandedStep {
        id: encode_id.clone(),
        source_node_id: node_id.to_string(),
        label: "ABI encode burn call".into(),
        operation: Operation::AbiEncode(AbiEncodeOp {
            abi_params_json,
            data_mappings: vec![
                AbiDataMapping {
                    param_name: config.token_abi.inputs.first().map(|i| i.name.clone()).unwrap_or("from".into()),
                    value: resolve_value_expr(&config.from_source, id_map),
                },
                AbiDataMapping {
                    param_name: config.token_abi.inputs.get(1).map(|i| i.name.clone()).unwrap_or("amount".into()),
                    value: resolve_value_expr(&config.amount_source, id_map),
                },
            ],
        }),
        output: Some(OutputBinding {
            variable_name: format!("step_{}", encode_id.replace('-', "_")),
            ts_type: "{ encoded: string }".into(),
            destructure_fields: None,
        }),
    };

    let gas_limit: i64 = config.gas_limit.parse().unwrap_or(500_000);

    let write = ExpandedStep {
        id: write_id.clone(),
        source_node_id: node_id.to_string(),
        label: "Execute burn transaction".into(),
        operation: Operation::EvmWrite(EvmWriteOp {
            evm_client_binding: binding_name,
            receiver_address: ValueExpr::string(&config.token_contract_address),
            gas_limit: ValueExpr::integer(gas_limit),
            encoded_data: ValueExpr::binding(&encode_id, "encoded"),
            value_wei: None,
        }),
        output: Some(OutputBinding {
            variable_name: format!("step_{}", write_id.replace('-', "_")),
            ts_type: "{ txHash: string; status: string }".into(),
            destructure_fields: None,
        }),
    };

    vec![encode, write]
}

// ---------------------------------------------------------------------------
// transferToken → AbiEncode + EvmWrite
// ---------------------------------------------------------------------------

fn expand_transfer_token(
    node_id: &str,
    config: &TransferTokenConfig,
    id_map: &HashMap<String, String>,
) -> Vec<ExpandedStep> {
    let encode_id = format!("{}___encode", node_id);
    let write_id = format!("{}___write", node_id);
    let binding_name = make_evm_binding_name(&config.chain_selector_name);

    let abi_params_json = serde_json::to_string(&config.token_abi.inputs).unwrap_or_default();

    let encode = ExpandedStep {
        id: encode_id.clone(),
        source_node_id: node_id.to_string(),
        label: "ABI encode transfer call".into(),
        operation: Operation::AbiEncode(AbiEncodeOp {
            abi_params_json,
            data_mappings: vec![
                AbiDataMapping {
                    param_name: config.token_abi.inputs.first().map(|i| i.name.clone()).unwrap_or("to".into()),
                    value: resolve_value_expr(&config.to_source, id_map),
                },
                AbiDataMapping {
                    param_name: config.token_abi.inputs.get(1).map(|i| i.name.clone()).unwrap_or("amount".into()),
                    value: resolve_value_expr(&config.amount_source, id_map),
                },
            ],
        }),
        output: Some(OutputBinding {
            variable_name: format!("step_{}", encode_id.replace('-', "_")),
            ts_type: "{ encoded: string }".into(),
            destructure_fields: None,
        }),
    };

    let gas_limit: i64 = config.gas_limit.parse().unwrap_or(500_000);

    let write = ExpandedStep {
        id: write_id.clone(),
        source_node_id: node_id.to_string(),
        label: "Execute transfer transaction".into(),
        operation: Operation::EvmWrite(EvmWriteOp {
            evm_client_binding: binding_name,
            receiver_address: ValueExpr::string(&config.token_contract_address),
            gas_limit: ValueExpr::integer(gas_limit),
            encoded_data: ValueExpr::binding(&encode_id, "encoded"),
            value_wei: None,
        }),
        output: Some(OutputBinding {
            variable_name: format!("step_{}", write_id.replace('-', "_")),
            ts_type: "{ txHash: string; status: string }".into(),
            destructure_fields: None,
        }),
    };

    vec![encode, write]
}

// ---------------------------------------------------------------------------
// checkKyc → GetSecret + HttpRequest + JsonParse
// ---------------------------------------------------------------------------

fn expand_check_kyc(
    node_id: &str,
    config: &CheckKycConfig,
    id_map: &HashMap<String, String>,
) -> Vec<ExpandedStep> {
    let secret_id = format!("{}___secret", node_id);
    let http_id = format!("{}___http", node_id);
    let parse_id = format!("{}___parse", node_id);

    let get_secret = ExpandedStep {
        id: secret_id.clone(),
        source_node_id: node_id.to_string(),
        label: "Get KYC API key".into(),
        operation: Operation::GetSecret(GetSecretOp {
            secret_name: config.api_key_secret_name.clone(),
        }),
        output: Some(OutputBinding {
            variable_name: format!("step_{}", secret_id.replace('-', "_")),
            ts_type: "{ value: string }".into(),
            destructure_fields: None,
        }),
    };

    let wallet_address = resolve_value_expr(&config.wallet_address_source, id_map);

    let url = ValueExpr::Template {
        parts: vec![
            TemplatePart::Lit { value: config.provider_url.clone() },
            TemplatePart::Lit { value: "/".into() },
            TemplatePart::Expr { value: wallet_address },
        ],
    };

    let http_request = ExpandedStep {
        id: http_id.clone(),
        source_node_id: node_id.to_string(),
        label: "Check KYC status".into(),
        operation: Operation::HttpRequest(HttpRequestOp {
            method: HttpMethod::Get,
            url,
            headers: vec![],
            query_params: vec![],
            body: None,
            authentication: Some(HttpAuth::BearerToken {
                token_secret: config.api_key_secret_name.clone(),
            }),
            cache_max_age_seconds: Some(60),
            timeout_ms: Some(5000),
            expected_status_codes: vec![200],
            response_format: HttpResponseFormat::Json,
            consensus: ConsensusStrategy::Identical,
        }),
        output: Some(OutputBinding {
            variable_name: format!("step_{}", http_id.replace('-', "_")),
            ts_type: "{ statusCode: number; body: string; headers: Record<string, string> }".into(),
            destructure_fields: None,
        }),
    };

    let json_parse = ExpandedStep {
        id: parse_id.clone(),
        source_node_id: node_id.to_string(),
        label: "Parse KYC response".into(),
        operation: Operation::JsonParse(JsonParseOp {
            input: ValueExpr::binding(&http_id, "body"),
            source_path: None,
            strict: true,
        }),
        output: Some(OutputBinding {
            variable_name: format!("step_{}", parse_id.replace('-', "_")),
            ts_type: "any".into(),
            destructure_fields: None,
        }),
    };

    vec![get_secret, http_request, json_parse]
}

// ---------------------------------------------------------------------------
// checkBalance → EvmRead (no expansion, just mapping)
// ---------------------------------------------------------------------------

fn expand_check_balance(
    node_id: &str,
    config: &CheckBalanceConfig,
    id_map: &HashMap<String, String>,
) -> Vec<ExpandedStep> {
    let binding_name = make_evm_binding_name(&config.chain_selector_name);
    let abi_json = serde_json::to_string(&config.token_abi).unwrap_or_default();

    let address_value = resolve_value_expr(&config.address_source, id_map);

    let step = ExpandedStep {
        id: node_id.to_string(),
        source_node_id: node_id.to_string(),
        label: "Check token balance".into(),
        operation: Operation::EvmRead(EvmReadOp {
            evm_client_binding: binding_name,
            contract_address: ValueExpr::string(&config.token_contract_address),
            function_name: config.token_abi.name.clone(),
            abi_json,
            args: vec![EvmArg {
                abi_type: "address".into(),
                value: address_value,
            }],
            from_address: None,
            block_number: None,
        }),
        output: Some(OutputBinding {
            variable_name: format!("step_{}", node_id.replace('-', "_")),
            ts_type: "any".into(),
            destructure_fields: None,
        }),
    };

    vec![step]
}
