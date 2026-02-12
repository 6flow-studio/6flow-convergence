//! WASM entry points for browser use.

use wasm_bindgen::prelude::*;

use crate::codegen;
use crate::error::CompilerError;

/// Validate a workflow JSON: parse + graph validation.
/// Returns a JSON array of CompilerError objects.
#[wasm_bindgen]
pub fn validate_workflow(json: &str) -> JsValue {
    let result = validate_workflow_inner(json);
    serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
}

fn validate_workflow_inner(json: &str) -> Vec<ErrorDto> {
    let workflow = match crate::parse::parse(json) {
        Ok(w) => w,
        Err(errors) => return errors.into_iter().map(ErrorDto::from).collect(),
    };

    let graph = match crate::parse::WorkflowGraph::build(&workflow) {
        Ok(g) => g,
        Err(errors) => return errors.into_iter().map(ErrorDto::from).collect(),
    };

    let errors = crate::validate::validate_graph(&workflow, &graph);
    errors.into_iter().map(ErrorDto::from).collect()
}

/// Validate a single node JSON against a global config JSON.
/// Returns a JSON array of CompilerError objects.
#[wasm_bindgen]
pub fn validate_node(node_json: &str, global_config_json: &str) -> JsValue {
    let result = validate_node_inner(node_json, global_config_json);
    serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
}

fn validate_node_inner(node_json: &str, global_config_json: &str) -> Vec<ErrorDto> {
    let node = match serde_json::from_str::<crate::parse::types::WorkflowNode>(node_json) {
        Ok(n) => n,
        Err(e) => {
            return vec![ErrorDto {
                code: "P001".into(),
                phase: "Parse".into(),
                message: format!("Failed to parse node JSON: {}", e),
                node_id: None,
            }];
        }
    };

    let global = match serde_json::from_str::<crate::parse::types::GlobalConfig>(global_config_json) {
        Ok(g) => g,
        Err(e) => {
            return vec![ErrorDto {
                code: "P001".into(),
                phase: "Parse".into(),
                message: format!("Failed to parse global config JSON: {}", e),
                node_id: None,
            }];
        }
    };

    let errors = crate::validate::validate_node(&node, &global);
    errors.into_iter().map(ErrorDto::from).collect()
}

/// Full pipeline: parse → validate → lower → IR validate → codegen.
/// Returns a JSON object with either `files` (success) or `errors` (failure).
#[wasm_bindgen]
pub fn compile_workflow(json: &str) -> JsValue {
    let result = compile_workflow_inner(json);
    serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
}

fn compile_workflow_inner(json: &str) -> CompileResult {
    // 1. Parse
    let workflow = match crate::parse::parse(json) {
        Ok(w) => w,
        Err(errors) => {
            return CompileResult::Errors(errors.into_iter().map(ErrorDto::from).collect());
        }
    };

    // 2. Build graph
    let graph = match crate::parse::WorkflowGraph::build(&workflow) {
        Ok(g) => g,
        Err(errors) => {
            return CompileResult::Errors(errors.into_iter().map(ErrorDto::from).collect());
        }
    };

    // 3. Graph validation
    let validation_errors = crate::validate::validate_graph(&workflow, &graph);
    if !validation_errors.is_empty() {
        return CompileResult::Errors(validation_errors.into_iter().map(ErrorDto::from).collect());
    }

    // 4. Lower to IR
    let ir = match crate::lower::lower(&workflow, &graph) {
        Ok(ir) => ir,
        Err(errors) => {
            return CompileResult::Errors(errors.into_iter().map(ErrorDto::from).collect());
        }
    };

    // 5. IR validation
    let ir_errors = crate::ir::validate_ir(&ir);
    if !ir_errors.is_empty() {
        let errors: Vec<ErrorDto> = ir_errors
            .into_iter()
            .map(|e| ErrorDto::from(CompilerError::from(e)))
            .collect();
        return CompileResult::Errors(errors);
    }

    // 6. Codegen
    let output = codegen::codegen(&ir);

    CompileResult::Success(
        output
            .files
            .into_iter()
            .map(|f| FileDto {
                path: f.path,
                content: f.content,
            })
            .collect(),
    )
}

// ---------------------------------------------------------------------------
// DTOs for serialization to JS
// ---------------------------------------------------------------------------

#[derive(serde::Serialize, serde::Deserialize)]
struct ErrorDto {
    code: String,
    phase: String,
    message: String,
    node_id: Option<String>,
}

impl From<CompilerError> for ErrorDto {
    fn from(e: CompilerError) -> Self {
        ErrorDto {
            code: e.code,
            phase: e.phase.to_string(),
            message: e.message,
            node_id: e.node_id,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
struct FileDto {
    path: String,
    content: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(tag = "status")]
enum CompileResult {
    #[serde(rename = "success")]
    Success(Vec<FileDto>),
    #[serde(rename = "errors")]
    Errors(Vec<ErrorDto>),
}
