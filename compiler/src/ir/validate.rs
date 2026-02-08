//! IR invariant validation.
//!
//! Validates that a `WorkflowIR` satisfies all structural, binding, semantic,
//! and control flow invariants before codegen.

use std::collections::HashSet;

use crate::ir::types::*;

/// CRE capability budget limits per workflow execution.
const MAX_HTTP_CALLS: usize = 5;
const MAX_EVM_READS: usize = 10;
const MAX_EVM_WRITES: usize = 5;

#[derive(Debug, Clone)]
pub struct ValidationError {
    pub code: &'static str,
    pub message: String,
    /// The step ID where the error was found, if applicable.
    pub step_id: Option<String>,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.step_id {
            Some(id) => write!(f, "[{}] {} (at step '{}')", self.code, self.message, id),
            None => write!(f, "[{}] {}", self.code, self.message),
        }
    }
}

/// Validate a WorkflowIR against all invariants. Returns all errors found.
pub fn validate_ir(ir: &WorkflowIR) -> Vec<ValidationError> {
    let mut errors = Vec::new();

    validate_handler_body_non_empty(ir, &mut errors);
    validate_unique_step_ids(ir, &mut errors);
    validate_forward_bindings(ir, &mut errors);
    validate_branch_merge_consistency(ir, &mut errors);
    validate_secret_refs(ir, &mut errors);
    validate_evm_chain_refs(ir, &mut errors);
    validate_cre_budget(ir, &mut errors);
    validate_return_paths(ir, &mut errors);

    errors
}

// ---------------------------------------------------------------------------
// Invariant: handler body is non-empty
// ---------------------------------------------------------------------------

fn validate_handler_body_non_empty(ir: &WorkflowIR, errors: &mut Vec<ValidationError>) {
    if ir.handler_body.steps.is_empty() {
        errors.push(ValidationError {
            code: "E001",
            message: "Handler body must contain at least one step".into(),
            step_id: None,
        });
    }
}

// ---------------------------------------------------------------------------
// Invariant: all step IDs are globally unique
// ---------------------------------------------------------------------------

fn validate_unique_step_ids(ir: &WorkflowIR, errors: &mut Vec<ValidationError>) {
    let mut seen = HashSet::new();
    collect_step_ids(&ir.handler_body, &mut seen, errors);
}

fn collect_step_ids(
    block: &Block,
    seen: &mut HashSet<String>,
    errors: &mut Vec<ValidationError>,
) {
    for step in &block.steps {
        if !seen.insert(step.id.clone()) {
            errors.push(ValidationError {
                code: "E002",
                message: format!("Duplicate step ID '{}'", step.id),
                step_id: Some(step.id.clone()),
            });
        }
        // Recurse into branch blocks
        if let Operation::Branch(branch) = &step.operation {
            collect_step_ids(&branch.true_branch, seen, errors);
            collect_step_ids(&branch.false_branch, seen, errors);
        }
    }
}

// ---------------------------------------------------------------------------
// Invariant: forward-only binding references
// ---------------------------------------------------------------------------

fn validate_forward_bindings(ir: &WorkflowIR, errors: &mut Vec<ValidationError>) {
    let mut scope = HashSet::new();
    validate_block_bindings(&ir.handler_body, &mut scope, errors);
}

fn validate_block_bindings(
    block: &Block,
    parent_scope: &mut HashSet<String>,
    errors: &mut Vec<ValidationError>,
) {
    // Snapshot the scope at block entry so we can restore after branches
    let mut scope = parent_scope.clone();

    for step in &block.steps {
        // Check all ValueExpr refs in this step point to bindings in scope
        let refs = collect_binding_refs_from_step(step);
        for binding_ref in &refs {
            if !scope.contains(&binding_ref.step_id) {
                errors.push(ValidationError {
                    code: "E003",
                    message: format!(
                        "Step '{}' references binding '{}' which is not in scope \
                         (not defined in a prior step or an ancestor block)",
                        step.id, binding_ref.step_id
                    ),
                    step_id: Some(step.id.clone()),
                });
            }
        }

        // For branches, validate each arm with its own scope
        if let Operation::Branch(branch) = &step.operation {
            let mut true_scope = scope.clone();
            validate_block_bindings(&branch.true_branch, &mut true_scope, errors);

            let mut false_scope = scope.clone();
            validate_block_bindings(&branch.false_branch, &mut false_scope, errors);
        }

        // Add this step's output to the scope AFTER checking refs
        if let Some(output) = &step.output {
            scope.insert(step.id.clone());
            // Also add the variable name for lookup convenience
            let _ = &output.variable_name;
        }
    }

    // Propagate non-branch bindings back to parent
    *parent_scope = scope;
}

/// Extract all BindingRefs from a step's operation.
fn collect_binding_refs_from_step(step: &Step) -> Vec<BindingRef> {
    let mut refs = Vec::new();
    collect_binding_refs_from_operation(&step.operation, &mut refs);
    refs
}

fn collect_binding_refs_from_value_expr(expr: &ValueExpr, refs: &mut Vec<BindingRef>) {
    match expr {
        ValueExpr::Binding(r) => refs.push(r.clone()),
        ValueExpr::Template { parts } => {
            for part in parts {
                if let TemplatePart::Expr { value } = part {
                    collect_binding_refs_from_value_expr(value, refs);
                }
            }
        }
        ValueExpr::Literal(_)
        | ValueExpr::ConfigRef { .. }
        | ValueExpr::TriggerDataRef { .. }
        | ValueExpr::RawExpr { .. } => {}
    }
}

fn collect_binding_refs_from_operation(op: &Operation, refs: &mut Vec<BindingRef>) {
    match op {
        Operation::HttpRequest(o) => {
            collect_binding_refs_from_value_expr(&o.url, refs);
            for (_, v) in &o.headers {
                collect_binding_refs_from_value_expr(v, refs);
            }
            for (_, v) in &o.query_params {
                collect_binding_refs_from_value_expr(v, refs);
            }
            if let Some(body) = &o.body {
                collect_binding_refs_from_value_expr(&body.data, refs);
            }
        }
        Operation::EvmRead(o) => {
            collect_binding_refs_from_value_expr(&o.contract_address, refs);
            for arg in &o.args {
                collect_binding_refs_from_value_expr(&arg.value, refs);
            }
            if let Some(v) = &o.from_address {
                collect_binding_refs_from_value_expr(v, refs);
            }
            if let Some(v) = &o.block_number {
                collect_binding_refs_from_value_expr(v, refs);
            }
        }
        Operation::EvmWrite(o) => {
            collect_binding_refs_from_value_expr(&o.receiver_address, refs);
            collect_binding_refs_from_value_expr(&o.gas_limit, refs);
            collect_binding_refs_from_value_expr(&o.encoded_data, refs);
            if let Some(v) = &o.value_wei {
                collect_binding_refs_from_value_expr(v, refs);
            }
        }
        Operation::GetSecret(_) => {}
        Operation::CodeNode(o) => {
            for binding in &o.input_bindings {
                collect_binding_refs_from_value_expr(&binding.value, refs);
            }
        }
        Operation::JsonParse(o) => {
            collect_binding_refs_from_value_expr(&o.input, refs);
        }
        Operation::AbiEncode(o) => {
            for mapping in &o.data_mappings {
                collect_binding_refs_from_value_expr(&mapping.value, refs);
            }
        }
        Operation::AbiDecode(o) => {
            collect_binding_refs_from_value_expr(&o.input, refs);
        }
        Operation::Branch(o) => {
            for cond in &o.conditions {
                collect_binding_refs_from_value_expr(&cond.field, refs);
                if let Some(v) = &cond.value {
                    collect_binding_refs_from_value_expr(v, refs);
                }
            }
            // Don't recurse into branch blocks here — handled separately
        }
        Operation::Filter(o) => {
            for cond in &o.conditions {
                collect_binding_refs_from_value_expr(&cond.field, refs);
                if let Some(v) = &cond.value {
                    collect_binding_refs_from_value_expr(v, refs);
                }
            }
        }
        Operation::Merge(o) => {
            for input in &o.inputs {
                collect_binding_refs_from_value_expr(&input.value, refs);
            }
        }
        Operation::AiCall(o) => {
            collect_binding_refs_from_value_expr(&o.base_url, refs);
            collect_binding_refs_from_value_expr(&o.model, refs);
            collect_binding_refs_from_value_expr(&o.system_prompt, refs);
            collect_binding_refs_from_value_expr(&o.user_prompt, refs);
        }
        Operation::Log(o) => {
            collect_binding_refs_from_value_expr(&o.message, refs);
        }
        Operation::ErrorThrow(o) => {
            collect_binding_refs_from_value_expr(&o.message, refs);
        }
        Operation::Return(o) => {
            collect_binding_refs_from_value_expr(&o.expression, refs);
        }
    }
}

// ---------------------------------------------------------------------------
// Invariant: branch/merge consistency
// ---------------------------------------------------------------------------

fn validate_branch_merge_consistency(ir: &WorkflowIR, errors: &mut Vec<ValidationError>) {
    validate_block_branch_merge(&ir.handler_body, errors);
}

fn validate_block_branch_merge(block: &Block, errors: &mut Vec<ValidationError>) {
    for (i, step) in block.steps.iter().enumerate() {
        if let Operation::Branch(branch) = &step.operation {
            if let Some(merge_id) = &branch.reconverge_at {
                // The merge step must be the next step in this block
                let next = block.steps.get(i + 1);
                match next {
                    Some(next_step) => {
                        if next_step.id != *merge_id {
                            errors.push(ValidationError {
                                code: "E004",
                                message: format!(
                                    "Branch '{}' declares reconverge_at='{}', \
                                     but the next step is '{}'. \
                                     Merge must immediately follow its Branch.",
                                    step.id, merge_id, next_step.id
                                ),
                                step_id: Some(step.id.clone()),
                            });
                        }
                        // Verify the next step is actually a Merge referencing this branch
                        if let Some(next_step) = next {
                            if let Operation::Merge(merge) = &next_step.operation {
                                if merge.branch_step_id != step.id {
                                    errors.push(ValidationError {
                                        code: "E005",
                                        message: format!(
                                            "Merge '{}' references branch_step_id='{}', \
                                             but should reference '{}'",
                                            next_step.id, merge.branch_step_id, step.id
                                        ),
                                        step_id: Some(next_step.id.clone()),
                                    });
                                }
                            } else {
                                errors.push(ValidationError {
                                    code: "E006",
                                    message: format!(
                                        "Step '{}' should be a Merge operation \
                                         (reconverge_at target of branch '{}')",
                                        next_step.id, step.id
                                    ),
                                    step_id: Some(next_step.id.clone()),
                                });
                            }
                        }
                    }
                    None => {
                        errors.push(ValidationError {
                            code: "E004",
                            message: format!(
                                "Branch '{}' declares reconverge_at='{}', \
                                 but there are no more steps in this block",
                                step.id, merge_id
                            ),
                            step_id: Some(step.id.clone()),
                        });
                    }
                }
            }

            // Recurse into branch blocks
            validate_block_branch_merge(&branch.true_branch, errors);
            validate_block_branch_merge(&branch.false_branch, errors);
        }
    }
}

// ---------------------------------------------------------------------------
// Invariant: every secret reference is declared
// ---------------------------------------------------------------------------

fn validate_secret_refs(ir: &WorkflowIR, errors: &mut Vec<ValidationError>) {
    let declared: HashSet<&str> = ir.required_secrets.iter().map(|s| s.name.as_str()).collect();
    validate_block_secret_refs(&ir.handler_body, &declared, errors);
}

fn validate_block_secret_refs(
    block: &Block,
    declared: &HashSet<&str>,
    errors: &mut Vec<ValidationError>,
) {
    for step in &block.steps {
        let secret_names = collect_secret_refs_from_step(step);
        for name in secret_names {
            if !declared.contains(name.as_str()) {
                errors.push(ValidationError {
                    code: "E007",
                    message: format!(
                        "Secret '{}' used in step '{}' is not declared in required_secrets",
                        name, step.id
                    ),
                    step_id: Some(step.id.clone()),
                });
            }
        }
        if let Operation::Branch(branch) = &step.operation {
            validate_block_secret_refs(&branch.true_branch, declared, errors);
            validate_block_secret_refs(&branch.false_branch, declared, errors);
        }
    }
}

fn collect_secret_refs_from_step(step: &Step) -> Vec<String> {
    let mut secrets = Vec::new();
    match &step.operation {
        Operation::GetSecret(o) => secrets.push(o.secret_name.clone()),
        Operation::HttpRequest(o) => {
            if let Some(auth) = &o.authentication {
                match auth {
                    HttpAuth::HeaderAuth { value_secret, .. } => {
                        secrets.push(value_secret.clone());
                    }
                    HttpAuth::BasicAuth {
                        username_secret,
                        password_secret,
                    } => {
                        secrets.push(username_secret.clone());
                        secrets.push(password_secret.clone());
                    }
                    HttpAuth::BearerToken { token_secret } => {
                        secrets.push(token_secret.clone());
                    }
                    HttpAuth::QueryAuth { value_secret, .. } => {
                        secrets.push(value_secret.clone());
                    }
                }
            }
        }
        Operation::AiCall(o) => secrets.push(o.api_key_secret.clone()),
        Operation::Branch(branch) => {
            for s in &branch.true_branch.steps {
                secrets.extend(collect_secret_refs_from_step(s));
            }
            for s in &branch.false_branch.steps {
                secrets.extend(collect_secret_refs_from_step(s));
            }
        }
        _ => {}
    }
    secrets
}

// ---------------------------------------------------------------------------
// Invariant: every evm_client_binding references a declared chain
// ---------------------------------------------------------------------------

fn validate_evm_chain_refs(ir: &WorkflowIR, errors: &mut Vec<ValidationError>) {
    let declared: HashSet<&str> = ir.evm_chains.iter().map(|c| c.binding_name.as_str()).collect();

    // Check trigger
    if let TriggerDef::EvmLog(trigger) = &ir.trigger {
        if !declared.contains(trigger.evm_client_binding.as_str()) {
            errors.push(ValidationError {
                code: "E008",
                message: format!(
                    "Trigger references evm_client_binding '{}' which is not in evm_chains",
                    trigger.evm_client_binding
                ),
                step_id: None,
            });
        }
    }

    validate_block_evm_refs(&ir.handler_body, &declared, errors);
}

fn validate_block_evm_refs(
    block: &Block,
    declared: &HashSet<&str>,
    errors: &mut Vec<ValidationError>,
) {
    for step in &block.steps {
        let binding = match &step.operation {
            Operation::EvmRead(o) => Some(&o.evm_client_binding),
            Operation::EvmWrite(o) => Some(&o.evm_client_binding),
            _ => None,
        };
        if let Some(b) = binding {
            if !declared.contains(b.as_str()) {
                errors.push(ValidationError {
                    code: "E008",
                    message: format!(
                        "Step '{}' references evm_client_binding '{}' which is not in evm_chains",
                        step.id, b
                    ),
                    step_id: Some(step.id.clone()),
                });
            }
        }
        if let Operation::Branch(branch) = &step.operation {
            validate_block_evm_refs(&branch.true_branch, declared, errors);
            validate_block_evm_refs(&branch.false_branch, declared, errors);
        }
    }
}

// ---------------------------------------------------------------------------
// Invariant: CRE capability budget
// ---------------------------------------------------------------------------

fn validate_cre_budget(ir: &WorkflowIR, errors: &mut Vec<ValidationError>) {
    let mut http_count = 0;
    let mut evm_read_count = 0;
    let mut evm_write_count = 0;
    count_capabilities(&ir.handler_body, &mut http_count, &mut evm_read_count, &mut evm_write_count);

    if http_count > MAX_HTTP_CALLS {
        errors.push(ValidationError {
            code: "E009",
            message: format!(
                "Workflow uses {} HTTP calls, exceeding CRE limit of {}",
                http_count, MAX_HTTP_CALLS
            ),
            step_id: None,
        });
    }
    if evm_read_count > MAX_EVM_READS {
        errors.push(ValidationError {
            code: "E010",
            message: format!(
                "Workflow uses {} EVM reads, exceeding CRE limit of {}",
                evm_read_count, MAX_EVM_READS
            ),
            step_id: None,
        });
    }
    if evm_write_count > MAX_EVM_WRITES {
        errors.push(ValidationError {
            code: "E011",
            message: format!(
                "Workflow uses {} EVM writes, exceeding CRE limit of {}",
                evm_write_count, MAX_EVM_WRITES
            ),
            step_id: None,
        });
    }
}

fn count_capabilities(
    block: &Block,
    http: &mut usize,
    evm_read: &mut usize,
    evm_write: &mut usize,
) {
    for step in &block.steps {
        match &step.operation {
            Operation::HttpRequest(_) | Operation::AiCall(_) => *http += 1,
            Operation::EvmRead(_) => *evm_read += 1,
            Operation::EvmWrite(_) => *evm_write += 1,
            Operation::Branch(branch) => {
                // Count the worse branch (both could run in different executions,
                // but CRE counts per execution so we take the max of each branch)
                let mut true_http = 0;
                let mut true_read = 0;
                let mut true_write = 0;
                count_capabilities(&branch.true_branch, &mut true_http, &mut true_read, &mut true_write);

                let mut false_http = 0;
                let mut false_read = 0;
                let mut false_write = 0;
                count_capabilities(&branch.false_branch, &mut false_http, &mut false_read, &mut false_write);

                *http += true_http.max(false_http);
                *evm_read += true_read.max(false_read);
                *evm_write += true_write.max(false_write);
            }
            _ => {}
        }
    }
}

// ---------------------------------------------------------------------------
// Invariant: every execution path ends with Return or ErrorThrow
// ---------------------------------------------------------------------------

fn validate_return_paths(ir: &WorkflowIR, errors: &mut Vec<ValidationError>) {
    if !block_terminates(&ir.handler_body) {
        errors.push(ValidationError {
            code: "E012",
            message: "Not all execution paths end with a Return or ErrorThrow step".into(),
            step_id: None,
        });
    }
}

/// Returns true if every execution path through this block ends with Return or ErrorThrow.
fn block_terminates(block: &Block) -> bool {
    if block.steps.is_empty() {
        return false;
    }

    let last = block.steps.last().unwrap();
    match &last.operation {
        Operation::Return(_) | Operation::ErrorThrow(_) => true,
        Operation::Branch(branch) => {
            // If the branch has no reconverge (both sides terminate independently),
            // both branches must terminate.
            if branch.reconverge_at.is_none() {
                block_terminates(&branch.true_branch) && block_terminates(&branch.false_branch)
            } else {
                // Branch reconverges — check if there's a Return/Error after the merge.
                // The merge is not the last step, so the block continues. The overall
                // block terminates if something after the branch terminates it.
                // Since the branch is not the last step (merge follows), this returns false
                // and the loop will check the actual last step of the block.
                false
            }
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn minimal_valid_ir() -> WorkflowIR {
        WorkflowIR {
            metadata: WorkflowMetadata {
                id: "test-1".into(),
                name: "Test Workflow".into(),
                description: None,
                version: "1.0.0".into(),
                is_testnet: true,
                default_chain_selector: None,
            },
            trigger: TriggerDef::Cron(CronTriggerDef {
                schedule: ValueExpr::config("schedule"),
                timezone: None,
            }),
            trigger_param: TriggerParam::CronTrigger,
            config_schema: vec![ConfigField {
                name: "schedule".into(),
                zod_type: ZodType::String,
                default_value: Some("0 */5 * * * *".into()),
                description: None,
            }],
            required_secrets: vec![],
            evm_chains: vec![],
            handler_body: Block {
                steps: vec![
                    Step {
                        id: "log-1".into(),
                        source_node_ids: vec!["log-1".into()],
                        label: "Log trigger".into(),
                        operation: Operation::Log(LogOp {
                            level: LogLevel::Info,
                            message: ValueExpr::string("Triggered"),
                        }),
                        output: None,
                    },
                    Step {
                        id: "return-1".into(),
                        source_node_ids: vec!["return-1".into()],
                        label: "Return success".into(),
                        operation: Operation::Return(ReturnOp {
                            expression: ValueExpr::string("Done"),
                        }),
                        output: None,
                    },
                ],
            },
        }
    }

    #[test]
    fn valid_minimal_ir_passes() {
        let ir = minimal_valid_ir();
        let errors = validate_ir(&ir);
        assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);
    }

    #[test]
    fn empty_handler_body_fails() {
        let mut ir = minimal_valid_ir();
        ir.handler_body.steps.clear();
        let errors = validate_ir(&ir);
        assert!(errors.iter().any(|e| e.code == "E001"));
    }

    #[test]
    fn duplicate_step_id_fails() {
        let mut ir = minimal_valid_ir();
        ir.handler_body.steps[1].id = "log-1".into(); // duplicate
        let errors = validate_ir(&ir);
        assert!(errors.iter().any(|e| e.code == "E002"));
    }

    #[test]
    fn forward_binding_ref_ok() {
        let mut ir = minimal_valid_ir();
        ir.handler_body.steps = vec![
            Step {
                id: "http-1".into(),
                source_node_ids: vec!["http-1".into()],
                label: "Fetch data".into(),
                operation: Operation::HttpRequest(HttpRequestOp {
                    method: HttpMethod::Get,
                    url: ValueExpr::string("https://example.com"),
                    headers: vec![],
                    query_params: vec![],
                    body: None,
                    authentication: None,
                    cache_max_age_seconds: None,
                    timeout_ms: None,
                    expected_status_codes: vec![200],
                    response_format: HttpResponseFormat::Json,
                    consensus: ConsensusStrategy::Identical,
                }),
                output: Some(OutputBinding {
                    variable_name: "step_http_1".into(),
                    ts_type: "{ statusCode: number; body: string }".into(),
                    destructure_fields: None,
                }),
            },
            Step {
                id: "parse-1".into(),
                source_node_ids: vec!["parse-1".into()],
                label: "Parse response".into(),
                operation: Operation::JsonParse(JsonParseOp {
                    input: ValueExpr::binding("http-1", "body"),
                    source_path: None,
                    strict: true,
                }),
                output: Some(OutputBinding {
                    variable_name: "step_parse_1".into(),
                    ts_type: "any".into(),
                    destructure_fields: None,
                }),
            },
            Step {
                id: "return-1".into(),
                source_node_ids: vec!["return-1".into()],
                label: "Return".into(),
                operation: Operation::Return(ReturnOp {
                    expression: ValueExpr::string("ok"),
                }),
                output: None,
            },
        ];
        let errors = validate_ir(&ir);
        assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);
    }

    #[test]
    fn backward_binding_ref_fails() {
        let mut ir = minimal_valid_ir();
        ir.handler_body.steps = vec![
            Step {
                id: "parse-1".into(),
                source_node_ids: vec!["parse-1".into()],
                label: "Parse (references future step)".into(),
                operation: Operation::JsonParse(JsonParseOp {
                    input: ValueExpr::binding("http-1", "body"), // http-1 not defined yet!
                    source_path: None,
                    strict: true,
                }),
                output: Some(OutputBinding {
                    variable_name: "step_parse_1".into(),
                    ts_type: "any".into(),
                    destructure_fields: None,
                }),
            },
            Step {
                id: "http-1".into(),
                source_node_ids: vec!["http-1".into()],
                label: "Fetch data".into(),
                operation: Operation::HttpRequest(HttpRequestOp {
                    method: HttpMethod::Get,
                    url: ValueExpr::string("https://example.com"),
                    headers: vec![],
                    query_params: vec![],
                    body: None,
                    authentication: None,
                    cache_max_age_seconds: None,
                    timeout_ms: None,
                    expected_status_codes: vec![200],
                    response_format: HttpResponseFormat::Json,
                    consensus: ConsensusStrategy::Identical,
                }),
                output: Some(OutputBinding {
                    variable_name: "step_http_1".into(),
                    ts_type: "{ statusCode: number; body: string }".into(),
                    destructure_fields: None,
                }),
            },
            Step {
                id: "return-1".into(),
                source_node_ids: vec!["return-1".into()],
                label: "Return".into(),
                operation: Operation::Return(ReturnOp {
                    expression: ValueExpr::string("ok"),
                }),
                output: None,
            },
        ];
        let errors = validate_ir(&ir);
        assert!(errors.iter().any(|e| e.code == "E003"));
    }

    #[test]
    fn undeclared_secret_fails() {
        let mut ir = minimal_valid_ir();
        ir.handler_body.steps.insert(
            0,
            Step {
                id: "secret-1".into(),
                source_node_ids: vec!["secret-1".into()],
                label: "Get API key".into(),
                operation: Operation::GetSecret(GetSecretOp {
                    secret_name: "API_KEY".into(),
                }),
                output: Some(OutputBinding {
                    variable_name: "step_secret_1".into(),
                    ts_type: "{ value: string }".into(),
                    destructure_fields: None,
                }),
            },
        );
        // required_secrets is empty — should fail
        let errors = validate_ir(&ir);
        assert!(errors.iter().any(|e| e.code == "E007"));
    }

    #[test]
    fn missing_return_fails() {
        let mut ir = minimal_valid_ir();
        // Remove the return step
        ir.handler_body.steps.pop();
        let errors = validate_ir(&ir);
        assert!(errors.iter().any(|e| e.code == "E012"));
    }

    #[test]
    fn cre_budget_exceeded_fails() {
        let mut ir = minimal_valid_ir();
        // Add 6 HTTP calls (exceeds limit of 5)
        let mut steps: Vec<Step> = (0..6)
            .map(|i| Step {
                id: format!("http-{}", i),
                source_node_ids: vec![format!("http-{}", i)],
                label: format!("HTTP call {}", i),
                operation: Operation::HttpRequest(HttpRequestOp {
                    method: HttpMethod::Get,
                    url: ValueExpr::string("https://example.com"),
                    headers: vec![],
                    query_params: vec![],
                    body: None,
                    authentication: None,
                    cache_max_age_seconds: None,
                    timeout_ms: None,
                    expected_status_codes: vec![200],
                    response_format: HttpResponseFormat::Json,
                    consensus: ConsensusStrategy::Identical,
                }),
                output: Some(OutputBinding {
                    variable_name: format!("step_http_{}", i),
                    ts_type: "any".into(),
                    destructure_fields: None,
                }),
            })
            .collect();
        steps.push(Step {
            id: "return-1".into(),
            source_node_ids: vec!["return-1".into()],
            label: "Return".into(),
            operation: Operation::Return(ReturnOp {
                expression: ValueExpr::string("ok"),
            }),
            output: None,
        });
        ir.handler_body.steps = steps;
        let errors = validate_ir(&ir);
        assert!(errors.iter().any(|e| e.code == "E009"));
    }
}
