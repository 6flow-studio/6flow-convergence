//! Rust types mirroring `shared/model/node.ts`.
//!
//! These types are the serde target for the frontend workflow JSON.
//! SYNC NOTE: Keep this file aligned with `shared/model/node.ts`.
//! When NodeType/config shapes change, also review validate/lower modules
//! and frontend registry/config renderers listed in `shared/model/node.ts`.

use serde::{Deserialize, Serialize};

// =============================================================================
// TOP-LEVEL WORKFLOW
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workflow {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: String,
    pub nodes: Vec<WorkflowNode>,
    pub edges: Vec<WorkflowEdge>,
    pub global_config: GlobalConfig,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub source_handle: Option<String>,
    pub target_handle: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalConfig {
    pub is_testnet: bool,
    pub secrets: Vec<SecretReference>,
    pub rpcs: Vec<RpcEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RpcEntry {
    pub chain_name: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretReference {
    pub name: String,
    pub env_variable: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

// =============================================================================
// NODE SETTINGS
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NodeSettings {
    pub retry_on_fail: Option<RetryConfig>,
    pub on_error: Option<OnErrorBehavior>,
    pub notes: Option<String>,
    pub execute_once: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetryConfig {
    pub enabled: bool,
    pub max_tries: u32,
    pub wait_between_tries: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OnErrorBehavior {
    Stop,
    Continue,
    ContinueWithError,
}

// =============================================================================
// NODE BASE
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeData<C> {
    pub label: String,
    pub config: C,
}

// =============================================================================
// WORKFLOW NODE — tagged union over 23 node types
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WorkflowNode {
    // Triggers
    #[serde(rename = "cronTrigger")]
    CronTrigger(NodeBase<CronTriggerConfig>),
    #[serde(rename = "httpTrigger")]
    HttpTrigger(NodeBase<HttpTriggerConfig>),
    #[serde(rename = "evmLogTrigger")]
    EvmLogTrigger(NodeBase<EvmLogTriggerConfig>),

    // Actions
    #[serde(rename = "httpRequest")]
    HttpRequest(NodeBase<HttpRequestConfig>),
    #[serde(rename = "evmRead")]
    EvmRead(NodeBase<EvmReadConfig>),
    #[serde(rename = "evmWrite")]
    EvmWrite(NodeBase<EvmWriteConfig>),
    #[serde(rename = "getSecret")]
    GetSecret(NodeBase<GetSecretConfig>),

    // Transforms
    #[serde(rename = "codeNode")]
    CodeNode(NodeBase<CodeNodeConfig>),
    #[serde(rename = "jsonParse")]
    JsonParse(NodeBase<JsonParseConfig>),
    #[serde(rename = "abiEncode")]
    AbiEncode(NodeBase<AbiEncodeConfig>),
    #[serde(rename = "abiDecode")]
    AbiDecode(NodeBase<AbiDecodeConfig>),
    #[serde(rename = "merge")]
    Merge(NodeBase<MergeConfig>),

    // Control Flow
    #[serde(rename = "filter")]
    Filter(NodeBase<FilterConfig>),
    #[serde(rename = "if")]
    If(NodeBase<IfConfig>),

    // AI
    #[serde(rename = "ai")]
    Ai(NodeBase<AiNodeConfig>),

    // Output
    #[serde(rename = "return")]
    Return(NodeBase<ReturnConfig>),
    #[serde(rename = "log")]
    Log(NodeBase<LogConfig>),
    #[serde(rename = "error")]
    Error(NodeBase<ErrorConfig>),

    // Tokenization
    #[serde(rename = "mintToken")]
    MintToken(NodeBase<MintTokenConfig>),
    #[serde(rename = "burnToken")]
    BurnToken(NodeBase<BurnTokenConfig>),
    #[serde(rename = "transferToken")]
    TransferToken(NodeBase<TransferTokenConfig>),

    // Regulation
    #[serde(rename = "checkKyc")]
    CheckKyc(NodeBase<CheckKycConfig>),
    #[serde(rename = "checkBalance")]
    CheckBalance(NodeBase<CheckBalanceConfig>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeBase<C> {
    pub id: String,
    pub position: Position,
    pub data: NodeData<C>,
    #[serde(default)]
    pub settings: Option<NodeSettings>,
}

impl WorkflowNode {
    pub fn id(&self) -> &str {
        match self {
            WorkflowNode::CronTrigger(n) => &n.id,
            WorkflowNode::HttpTrigger(n) => &n.id,
            WorkflowNode::EvmLogTrigger(n) => &n.id,
            WorkflowNode::HttpRequest(n) => &n.id,
            WorkflowNode::EvmRead(n) => &n.id,
            WorkflowNode::EvmWrite(n) => &n.id,
            WorkflowNode::GetSecret(n) => &n.id,
            WorkflowNode::CodeNode(n) => &n.id,
            WorkflowNode::JsonParse(n) => &n.id,
            WorkflowNode::AbiEncode(n) => &n.id,
            WorkflowNode::AbiDecode(n) => &n.id,
            WorkflowNode::Merge(n) => &n.id,
            WorkflowNode::Filter(n) => &n.id,
            WorkflowNode::If(n) => &n.id,
            WorkflowNode::Ai(n) => &n.id,
            WorkflowNode::Return(n) => &n.id,
            WorkflowNode::Log(n) => &n.id,
            WorkflowNode::Error(n) => &n.id,
            WorkflowNode::MintToken(n) => &n.id,
            WorkflowNode::BurnToken(n) => &n.id,
            WorkflowNode::TransferToken(n) => &n.id,
            WorkflowNode::CheckKyc(n) => &n.id,
            WorkflowNode::CheckBalance(n) => &n.id,
        }
    }

    pub fn label(&self) -> &str {
        match self {
            WorkflowNode::CronTrigger(n) => &n.data.label,
            WorkflowNode::HttpTrigger(n) => &n.data.label,
            WorkflowNode::EvmLogTrigger(n) => &n.data.label,
            WorkflowNode::HttpRequest(n) => &n.data.label,
            WorkflowNode::EvmRead(n) => &n.data.label,
            WorkflowNode::EvmWrite(n) => &n.data.label,
            WorkflowNode::GetSecret(n) => &n.data.label,
            WorkflowNode::CodeNode(n) => &n.data.label,
            WorkflowNode::JsonParse(n) => &n.data.label,
            WorkflowNode::AbiEncode(n) => &n.data.label,
            WorkflowNode::AbiDecode(n) => &n.data.label,
            WorkflowNode::Merge(n) => &n.data.label,
            WorkflowNode::Filter(n) => &n.data.label,
            WorkflowNode::If(n) => &n.data.label,
            WorkflowNode::Ai(n) => &n.data.label,
            WorkflowNode::Return(n) => &n.data.label,
            WorkflowNode::Log(n) => &n.data.label,
            WorkflowNode::Error(n) => &n.data.label,
            WorkflowNode::MintToken(n) => &n.data.label,
            WorkflowNode::BurnToken(n) => &n.data.label,
            WorkflowNode::TransferToken(n) => &n.data.label,
            WorkflowNode::CheckKyc(n) => &n.data.label,
            WorkflowNode::CheckBalance(n) => &n.data.label,
        }
    }

    pub fn node_type(&self) -> &'static str {
        match self {
            WorkflowNode::CronTrigger(_) => "cronTrigger",
            WorkflowNode::HttpTrigger(_) => "httpTrigger",
            WorkflowNode::EvmLogTrigger(_) => "evmLogTrigger",
            WorkflowNode::HttpRequest(_) => "httpRequest",
            WorkflowNode::EvmRead(_) => "evmRead",
            WorkflowNode::EvmWrite(_) => "evmWrite",
            WorkflowNode::GetSecret(_) => "getSecret",
            WorkflowNode::CodeNode(_) => "codeNode",
            WorkflowNode::JsonParse(_) => "jsonParse",
            WorkflowNode::AbiEncode(_) => "abiEncode",
            WorkflowNode::AbiDecode(_) => "abiDecode",
            WorkflowNode::Merge(_) => "merge",
            WorkflowNode::Filter(_) => "filter",
            WorkflowNode::If(_) => "if",
            WorkflowNode::Ai(_) => "ai",
            WorkflowNode::Return(_) => "return",
            WorkflowNode::Log(_) => "log",
            WorkflowNode::Error(_) => "error",
            WorkflowNode::MintToken(_) => "mintToken",
            WorkflowNode::BurnToken(_) => "burnToken",
            WorkflowNode::TransferToken(_) => "transferToken",
            WorkflowNode::CheckKyc(_) => "checkKyc",
            WorkflowNode::CheckBalance(_) => "checkBalance",
        }
    }

    pub fn is_trigger(&self) -> bool {
        matches!(
            self,
            WorkflowNode::CronTrigger(_)
                | WorkflowNode::HttpTrigger(_)
                | WorkflowNode::EvmLogTrigger(_)
        )
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self, WorkflowNode::Return(_) | WorkflowNode::Error(_))
    }
}

// =============================================================================
// ABI TYPES
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbiParameter {
    pub name: String,
    #[serde(rename = "type")]
    pub abi_type: String,
    pub indexed: Option<bool>,
    pub components: Option<Vec<AbiParameter>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbiFunction {
    #[serde(rename = "type")]
    pub abi_type: String,
    pub name: String,
    pub inputs: Vec<AbiParameter>,
    pub outputs: Vec<AbiParameter>,
    pub state_mutability: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbiEvent {
    #[serde(rename = "type")]
    pub abi_type: String,
    pub name: String,
    pub inputs: Vec<AbiParameter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvmArgDef {
    #[serde(rename = "type")]
    pub arg_type: String,
    pub value: String,
    pub abi_type: String,
}

// =============================================================================
// TRIGGER CONFIGS
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronTriggerConfig {
    pub schedule: String,
    pub timezone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpTriggerConfig {
    pub http_method: String,
    pub path: Option<String>,
    pub authentication: WebhookAuth,
    pub response_mode: String,
    pub response_code: Option<u16>,
    pub response_headers: Option<std::collections::HashMap<String, String>>,
    pub allowed_origins: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebhookAuth {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "evmSignature")]
    EvmSignature {
        #[serde(rename = "authorizedAddresses")]
        authorized_addresses: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvmLogTriggerConfig {
    pub chain_selector_name: String,
    pub contract_addresses: Vec<String>,
    pub event_signature: String,
    pub event_abi: AbiEvent,
    pub topic_filters: Option<TopicFilters>,
    pub block_confirmation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicFilters {
    pub topic1: Option<Vec<String>>,
    pub topic2: Option<Vec<String>>,
    pub topic3: Option<Vec<String>>,
}

// =============================================================================
// ACTION CONFIGS
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequestConfig {
    pub method: String,
    pub url: String,
    pub authentication: Option<HttpAuthConfig>,
    pub headers: Option<std::collections::HashMap<String, String>>,
    pub query_parameters: Option<std::collections::HashMap<String, String>>,
    pub body: Option<HttpBodyConfig>,
    pub cache_max_age: Option<u32>,
    pub timeout: Option<u32>,
    pub expected_status_codes: Option<Vec<u16>>,
    pub response_format: Option<String>,
    pub follow_redirects: Option<bool>,
    pub ignore_ssl: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum HttpAuthConfig {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "bearerToken")]
    BearerToken {
        #[serde(rename = "tokenSecret")]
        token_secret: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpBodyConfig {
    pub content_type: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvmReadConfig {
    pub chain_selector_name: String,
    pub contract_address: String,
    pub abi: AbiFunction,
    pub function_name: String,
    pub args: Vec<EvmArgDef>,
    pub from_address: Option<String>,
    pub block_number: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvmWriteConfig {
    pub chain_selector_name: String,
    pub receiver_address: String,
    pub gas_limit: String,
    pub abi_params: Vec<AbiParameter>,
    pub data_mapping: Vec<EvmArgDef>,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSecretConfig {
    pub secret_name: String,
}

// =============================================================================
// TRANSFORM CONFIGS
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeNodeConfig {
    pub code: String,
    pub language: Option<String>,
    pub execution_mode: String,
    pub input_variables: Vec<String>,
    pub timeout: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsonParseConfig {
    pub source_path: Option<String>,
    pub strict: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbiEncodeConfig {
    pub abi_params: Vec<AbiParameter>,
    pub data_mapping: Vec<AbiDataMappingDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbiDataMappingDef {
    pub param_name: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbiDecodeConfig {
    pub abi_params: Vec<AbiParameter>,
    pub output_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeConfig {
    pub strategy: MergeStrategyDef,
    #[serde(rename = "numberOfInputs")]
    pub number_of_inputs: Option<u32>,
    #[serde(rename = "clashHandling")]
    pub clash_handling: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "mode")]
pub enum MergeStrategyDef {
    #[serde(rename = "append")]
    Append,
    #[serde(rename = "matchingFields")]
    MatchingFields {
        #[serde(rename = "joinFields")]
        join_fields: Vec<String>,
        #[serde(rename = "outputType")]
        output_type: String,
    },
    #[serde(rename = "position")]
    Position {
        #[serde(rename = "includeUnpaired")]
        include_unpaired: Option<bool>,
    },
    #[serde(rename = "combinations")]
    Combinations,
    #[serde(rename = "custom")]
    Custom { code: String },
}

// =============================================================================
// CONTROL FLOW CONFIGS
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterConfig {
    pub conditions: Vec<Condition>,
    pub combine_with: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfConfig {
    pub conditions: Vec<Condition>,
    #[serde(rename = "combineWith")]
    pub combine_with: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Condition {
    pub field: String,
    pub operator: String,
    pub value: Option<String>,
}

// =============================================================================
// AI CONFIG
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiNodeConfig {
    pub provider: String,
    pub base_url: String,
    pub model: String,
    pub api_key_secret: String,
    pub system_prompt: String,
    pub user_prompt: String,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    pub response_format: Option<String>,
    pub timeout: Option<u32>,
    pub max_retries: Option<u32>,
}

// =============================================================================
// OUTPUT CONFIGS
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnConfig {
    pub return_expression: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogConfig {
    pub level: String,
    pub message_template: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorConfig {
    pub error_message: String,
}

// =============================================================================
// TOKENIZATION CONFIGS
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MintTokenConfig {
    pub chain_selector_name: String,
    pub token_contract_address: String,
    pub token_abi: AbiFunction,
    pub recipient_source: String,
    pub amount_source: String,
    pub gas_limit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BurnTokenConfig {
    pub chain_selector_name: String,
    pub token_contract_address: String,
    pub token_abi: AbiFunction,
    pub from_source: String,
    pub amount_source: String,
    pub gas_limit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferTokenConfig {
    pub chain_selector_name: String,
    pub token_contract_address: String,
    pub token_abi: AbiFunction,
    pub to_source: String,
    pub amount_source: String,
    pub gas_limit: String,
}

// =============================================================================
// REGULATION CONFIGS
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckKycConfig {
    pub provider_url: String,
    pub api_key_secret_name: String,
    pub wallet_address_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckBalanceConfig {
    pub chain_selector_name: String,
    pub token_contract_address: String,
    pub token_abi: AbiFunction,
    pub address_source: String,
}
