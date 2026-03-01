//! IR type definitions for the 6Flow compiler.
//!
//! The IR bridges the visual node-edge graph (input) and CRE TypeScript code (output).
//! A visual DAG of 23+ node types is lowered into a sequential execution plan with
//! structured branching that maps directly to a CRE handler function body.
//! SYNC NOTE: Node/config changes in `shared/model/node.ts` can require IR updates
//! here (new/changed trigger or operation shapes), plus matching lower/codegen/test updates.

use serde::{Deserialize, Serialize};

// =============================================================================
// TOP-LEVEL IR
// =============================================================================

/// Complete intermediate representation of a compiled 6Flow workflow.
/// Produced by the lowering pass, consumed by the codegen pass.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowIR {
    pub metadata: WorkflowMetadata,
    /// Exactly one trigger per workflow.
    pub trigger: TriggerDef,
    /// The handler function's second parameter type.
    pub trigger_param: TriggerParam,
    /// Fields for the generated Zod `configSchema` and `config.json`.
    pub config_schema: Vec<ConfigField>,
    /// Secrets that must be declared in `secrets.yaml`.
    pub required_secrets: Vec<SecretDeclaration>,
    /// Distinct EVM chains used. Each gets its own `EVMClient` instance.
    pub evm_chains: Vec<EvmChainUsage>,
    /// User-defined RPC endpoints from GlobalConfig.
    pub user_rpcs: Vec<RpcEntry>,
    /// The handler function body — the core execution plan.
    pub handler_body: Block,
}

/// A user-defined RPC endpoint for a specific blockchain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcEntry {
    pub chain_name: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowMetadata {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: String,
    pub is_testnet: bool,
    pub default_chain_selector: Option<String>,
}

// =============================================================================
// CONFIG SCHEMA
// =============================================================================

/// A field in the generated `configSchema` (Zod object).
/// Codegen emits `z.object({ [name]: z.[zod_type]() })`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigField {
    pub name: String,
    pub zod_type: ZodType,
    pub default_value: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ZodType {
    String,
    Number,
    Boolean,
    /// For complex/nested objects, stores the raw Zod expression.
    Raw(String),
}

// =============================================================================
// SECRETS
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretDeclaration {
    /// Logical name used in `runtime.getSecret({id: ...})`.
    pub name: String,
    /// Environment variable name for `.env`.
    pub env_variable: String,
}

// =============================================================================
// EVM CHAIN USAGE
// =============================================================================

/// A distinct chain that needs an `EVMClient` instantiation.
/// Multiple nodes on the same chain share one client.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmChainUsage {
    pub chain_selector_name: String,
    /// Generated variable name, e.g. `evmClient_ethereum_sepolia`.
    pub binding_name: String,
    /// Whether this chain is used for the log trigger (needs init in `initWorkflow`).
    pub used_for_trigger: bool,
}

// =============================================================================
// TRIGGER DEFINITIONS
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TriggerDef {
    Cron(CronTriggerDef),
    Http(HttpTriggerDef),
    EvmLog(EvmLogTriggerDef),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronTriggerDef {
    pub schedule: ValueExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpTriggerDef {
    /// EVM-signature authorized keys (empty for simulation/testnet).
    pub authorized_keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmLogTriggerDef {
    /// References `EvmChainUsage.binding_name`.
    pub evm_client_binding: String,
    pub contract_addresses: Vec<ValueExpr>,
    pub event_signature: String,
    pub event_abi_json: String,
    pub topic_filters: Vec<TopicFilter>,
    pub confidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicFilter {
    pub index: u8,
    pub values: Vec<String>,
}

/// The handler function's second parameter type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TriggerParam {
    /// No second parameter (shouldn't happen in practice).
    None,
    /// `trigger: CronTrigger` — has `scheduledTime`, `actualTime`.
    CronTrigger,
    /// `triggerData: HTTPPayload` — has `input: Uint8Array`.
    HttpRequest,
    /// `log: EVMLog` — has `topics`, `data`, `address`.
    EvmLog,
}

// =============================================================================
// VALUE EXPRESSIONS — the data reference model
// =============================================================================

/// Unified representation of any data reference in the IR.
/// Replaces `{{nodeId.field}}` from the visual graph.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum ValueExpr {
    /// A literal value: `"hello"`, `42`, `true`.
    Literal(LiteralValue),
    /// Reference to a previous step's output binding.
    Binding(BindingRef),
    /// Reference to `runtime.config.fieldName`.
    ConfigRef { field: String },
    /// Reference to trigger data: `triggerData.fieldName`.
    TriggerDataRef { field: String },
    /// Template string with interpolated expressions.
    /// `"https://api.com/${step_x.id}/status"`
    Template { parts: Vec<TemplatePart> },
    /// Raw TypeScript expression emitted verbatim (escape hatch).
    RawExpr { expr: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "literal_type")]
pub enum LiteralValue {
    String {
        value: String,
    },
    Number {
        value: f64,
    },
    Integer {
        value: i64,
    },
    Boolean {
        value: bool,
    },
    Null,
    /// JSON object/array as a string.
    Json {
        value: String,
    },
}

/// Reference to a named output from a previous step.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BindingRef {
    /// The `Step.id` that produced this value.
    pub step_id: String,
    /// Dot-separated field path. Empty string = the entire value.
    /// Example: `"body"`, `"eventArgs.from"`, `""`.
    pub field_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "part_type")]
pub enum TemplatePart {
    Lit { value: String },
    Expr { value: ValueExpr },
}

// =============================================================================
// VALUE EXPRESSION CONSTRUCTORS
// =============================================================================

impl ValueExpr {
    pub fn string(s: impl Into<String>) -> Self {
        ValueExpr::Literal(LiteralValue::String { value: s.into() })
    }

    pub fn number(n: f64) -> Self {
        ValueExpr::Literal(LiteralValue::Number { value: n })
    }

    pub fn integer(n: i64) -> Self {
        ValueExpr::Literal(LiteralValue::Integer { value: n })
    }

    pub fn boolean(b: bool) -> Self {
        ValueExpr::Literal(LiteralValue::Boolean { value: b })
    }

    pub fn null() -> Self {
        ValueExpr::Literal(LiteralValue::Null)
    }

    pub fn binding(step_id: impl Into<String>, field_path: impl Into<String>) -> Self {
        ValueExpr::Binding(BindingRef {
            step_id: step_id.into(),
            field_path: field_path.into(),
        })
    }

    pub fn config(field: impl Into<String>) -> Self {
        ValueExpr::ConfigRef {
            field: field.into(),
        }
    }

    pub fn trigger_data(field: impl Into<String>) -> Self {
        ValueExpr::TriggerDataRef {
            field: field.into(),
        }
    }

    pub fn raw(expr: impl Into<String>) -> Self {
        ValueExpr::RawExpr { expr: expr.into() }
    }
}

// =============================================================================
// BINDING MODEL
// =============================================================================

/// Defines what a step "exports" into the lexical scope.
///
/// Rules:
/// - SSA-like: each step produces at most one binding via `const`.
/// - Forward-only: bindings can only be referenced by later steps.
/// - Block-scoped: bindings inside a branch are NOT visible outside.
/// - Merge bridges scope: creates a new outer-scope binding from branch results.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputBinding {
    /// TypeScript variable name. Convention: `step_{sanitized_id}`.
    pub variable_name: String,
    /// TypeScript type annotation for the binding.
    pub ts_type: String,
    /// If Some, codegen emits `const { a, b } = expr` instead of `const x = expr`.
    pub destructure_fields: Option<Vec<String>>,
}

// =============================================================================
// BLOCK & STEPS — the execution plan
// =============================================================================

/// Ordered sequence of steps. Appears as:
/// - The top-level handler body
/// - Branch true/false arms
///
/// Steps execute sequentially, top to bottom.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub steps: Vec<Step>,
}

/// A single step in the execution plan.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Step {
    /// Unique ID. Matches source node ID, or `{nodeId}___{sub}` for expanded nodes.
    pub id: String,
    /// Original visual node ID(s) this was derived from.
    pub source_node_ids: Vec<String>,
    /// Human-readable label for debug comments in generated code.
    pub label: String,
    /// What this step does.
    pub operation: Operation,
    /// The output binding. None for steps that don't produce a value (Log, Return, Error).
    pub output: Option<OutputBinding>,
}

// =============================================================================
// OPERATIONS — one variant per code generation pattern
// =============================================================================

/// The operation a step performs. Each variant maps to a specific
/// TypeScript code generation pattern.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Operation {
    // --- CRE Capability Calls ---
    HttpRequest(HttpRequestOp),
    EvmRead(EvmReadOp),
    EvmWrite(EvmWriteOp),

    // --- Transforms (inline TypeScript) ---
    CodeNode(CodeNodeOp),
    JsonParse(JsonParseOp),
    AbiEncode(AbiEncodeOp),
    AbiDecode(AbiDecodeOp),

    // --- Control Flow ---
    Branch(BranchOp),
    Filter(FilterOp),
    Merge(MergeOp),

    // --- AI ---
    AiCall(AiCallOp),

    // --- Output ---
    ErrorThrow(ErrorThrowOp),
    Return(ReturnOp),
}

// =============================================================================
// HTTP REQUEST
// =============================================================================

/// `httpClient.sendRequest(runtime, fetchFn, consensus)(config).result()`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpRequestOp {
    pub method: HttpMethod,
    pub url: ValueExpr,
    pub headers: Vec<(String, ValueExpr)>,
    pub query_params: Vec<(String, ValueExpr)>,
    pub body: Option<HttpBody>,
    pub authentication: Option<HttpAuth>,
    pub cache_max_age_seconds: Option<u32>,
    pub timeout_ms: Option<u32>,
    pub expected_status_codes: Vec<u16>,
    pub response_format: HttpResponseFormat,
    pub consensus: ConsensusStrategy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Head,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpBody {
    pub content_type: HttpContentType,
    pub data: ValueExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HttpContentType {
    Json,
    FormUrlEncoded,
    Raw,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpAuth {
    pub token_secret: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HttpResponseFormat {
    Json,
    Text,
    Binary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ConsensusStrategy {
    /// `consensusIdenticalAggregation<T>()`
    Identical,
    /// `ConsensusAggregationByFields<T>({ field: median, ... })`
    MedianByFields { fields: Vec<String> },
    /// Custom consensus expression (escape hatch).
    Custom { expr: String },
}

// =============================================================================
// EVM READ
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmReadOp {
    /// References `EvmChainUsage.binding_name`.
    pub evm_client_binding: String,
    pub contract_address: ValueExpr,
    pub function_name: String,
    pub abi_json: String,
    pub args: Vec<EvmArg>,
    pub from_address: Option<ValueExpr>,
    pub block_number: Option<ValueExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmArg {
    pub abi_type: String,
    pub value: ValueExpr,
}

// =============================================================================
// EVM WRITE
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmWriteOp {
    /// References `EvmChainUsage.binding_name`.
    pub evm_client_binding: String,
    pub receiver_address: ValueExpr,
    pub gas_limit: ValueExpr,
    /// Pre-encoded calldata (from AbiEncode or RawExpr).
    pub encoded_data: ValueExpr,
    pub value_wei: Option<ValueExpr>,
}

// =============================================================================
// CODE NODE
// =============================================================================

/// User's raw TypeScript wrapped in an IIFE.
///
/// Generated code:
/// ```typescript
/// const step_code_1 = (() => {
///   const input1 = step_http_1.body;
///   // --- user code ---
///   ${user_code}
///   // --- end user code ---
/// })();
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeNodeOp {
    pub code: String,
    /// Bindings injected as `const` declarations before user code.
    pub input_bindings: Vec<CodeInputBinding>,
    pub execution_mode: CodeExecutionMode,
    pub timeout_ms: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeInputBinding {
    /// Variable name the user's code expects.
    pub variable_name: String,
    /// IR expression resolving to the value.
    pub value: ValueExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CodeExecutionMode {
    RunOnceForAll,
    RunOnceForEach,
}

// =============================================================================
// JSON PARSE
// =============================================================================

/// `JSON.parse(Buffer.from(input, "base64").toString("utf-8"))`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonParseOp {
    /// Typically a binding to an HTTP response body.
    pub input: ValueExpr,
    /// Optional JSONPath to extract a sub-value.
    pub source_path: Option<String>,
    pub strict: bool,
}

// =============================================================================
// ABI ENCODE / DECODE
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbiEncodeOp {
    /// Function name for `encodeFunctionData`. None for standalone parameter encoding.
    pub function_name: Option<String>,
    /// Full ABI JSON — function ABI item (when function_name is Some) or parameter array.
    pub abi_json: String,
    pub data_mappings: Vec<AbiDataMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbiDataMapping {
    pub param_name: String,
    pub value: ValueExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbiDecodeOp {
    pub input: ValueExpr,
    pub abi_json: String,
    pub output_names: Vec<String>,
}

// =============================================================================
// BRANCH (if node)
// =============================================================================

/// Conditional branch: `if (condition) { ... } else { ... }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchOp {
    pub conditions: Vec<ConditionIR>,
    pub combine_with: LogicCombinator,
    pub true_branch: Block,
    pub false_branch: Block,
    /// Step ID of the Merge that reconverges these branches.
    /// None if both branches terminate independently (both return/error).
    pub reconverge_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionIR {
    /// Left-hand side: the value to test.
    pub field: ValueExpr,
    pub operator: ComparisonOp,
    /// Right-hand side. None for unary operators (Exists, IsEmpty).
    pub value: Option<ValueExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ComparisonOp {
    Equals,
    NotEquals,
    Gt,
    Gte,
    Lt,
    Lte,
    Contains,
    NotContains,
    StartsWith,
    EndsWith,
    Regex,
    NotRegex,
    Exists,
    NotExists,
    IsEmpty,
    IsNotEmpty,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogicCombinator {
    And,
    Or,
}

// =============================================================================
// FILTER
// =============================================================================

/// Guard clause. Does NOT fork — either continues or early-returns.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterOp {
    pub conditions: Vec<ConditionIR>,
    pub combine_with: LogicCombinator,
    pub non_match_behavior: FilterNonMatchBehavior,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FilterNonMatchBehavior {
    /// `if (!condition) { return "msg" }`
    EarlyReturn { message: String },
    /// Wraps remaining steps in `if (condition) { ... }`.
    Skip,
}

// =============================================================================
// MERGE
// =============================================================================

/// Reconvergence point after a Branch.
///
/// For diamond patterns, codegen declares a `let` variable before the if/else
/// and each branch assigns to it. The Merge step's output binding IS that variable.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeOp {
    /// The Branch step this reconverges from.
    pub branch_step_id: String,
    pub strategy: MergeStrategy,
    pub inputs: Vec<MergeInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeInput {
    pub handle_name: String,
    pub value: ValueExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum MergeStrategy {
    /// Use whichever branch was taken. Codegen uses `let` + assign in each branch.
    PassThrough,
    /// Append all inputs into an array.
    Append,
    /// Custom merge expression.
    Custom { expr: String },
}

// =============================================================================
// AI CALL
// =============================================================================

/// AI inference call. Kept separate from HttpRequest so codegen can handle
/// provider-specific prompt formatting and response parsing.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiCallOp {
    pub provider: String,
    pub base_url: ValueExpr,
    pub model: ValueExpr,
    pub api_key_secret: String,
    pub system_prompt: ValueExpr,
    pub user_prompt: ValueExpr,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    pub response_format: AiResponseFormat,
    pub consensus: ConsensusStrategy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AiResponseFormat {
    Text,
    Json,
}

// =============================================================================
// OUTPUT / SIDE EFFECTS
// =============================================================================

/// `throw new Error(message)` — terminates execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorThrowOp {
    pub message: ValueExpr,
}

/// `return expression` — handler must return a string.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReturnOp {
    pub expression: ValueExpr,
}
