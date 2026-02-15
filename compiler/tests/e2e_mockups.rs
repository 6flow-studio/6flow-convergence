//! End-to-end compilation of sample mockup workflows.
//! Compiles each workflow and writes a single JSON output file.

use compiler::codegen;
use compiler::ir::validate_ir;
use compiler::lower;
use compiler::parse;
use compiler::validate;
use serde_json::json;
use std::fs;
use std::path::Path;

/// Run the full pipeline on a fixture JSON and write result as a single JSON file.
fn compile_and_save(fixture_name: &str, output_name: &str) {
    let json_str = fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures")
            .join(fixture_name),
    )
    .unwrap();

    let output_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("shared/sample/codegenOutput");
    fs::create_dir_all(&output_dir).unwrap();
    let output_path = output_dir.join(format!("{output_name}.json"));

    // Parse
    let workflow = match parse::parse(&json_str) {
        Ok(w) => w,
        Err(e) => {
            let result = json!({ "status": "error", "phase": "parse", "errors": format!("{e:?}") });
            fs::write(&output_path, serde_json::to_string_pretty(&result).unwrap()).unwrap();
            return;
        }
    };

    let graph = match parse::WorkflowGraph::build(&workflow) {
        Ok(g) => g,
        Err(e) => {
            let result = json!({ "status": "error", "phase": "graph", "errors": format!("{e:?}") });
            fs::write(&output_path, serde_json::to_string_pretty(&result).unwrap()).unwrap();
            return;
        }
    };

    // Validate
    let validation_errors = validate::validate_graph(&workflow, &graph);
    if !validation_errors.is_empty() {
        let errs: Vec<_> = validation_errors
            .iter()
            .map(|e| json!({ "code": e.code, "message": e.message }))
            .collect();
        let result = json!({ "status": "error", "phase": "validate", "errors": errs });
        fs::write(&output_path, serde_json::to_string_pretty(&result).unwrap()).unwrap();
        return;
    }

    // Lower
    let ir = match lower::lower(&workflow, &graph) {
        Ok(ir) => ir,
        Err(e) => {
            let result = json!({ "status": "error", "phase": "lower", "errors": format!("{e:?}") });
            fs::write(&output_path, serde_json::to_string_pretty(&result).unwrap()).unwrap();
            return;
        }
    };

    // IR validate (non-fatal warnings)
    let ir_warnings: Vec<_> = validate_ir(&ir)
        .iter()
        .map(|e| json!({ "code": e.code, "message": e.message }))
        .collect();

    // Codegen
    let output = codegen::codegen(&ir);

    let files: Vec<_> = output
        .files
        .iter()
        .map(|f| json!({ "path": f.path, "content": f.content }))
        .collect();

    let result = json!({
        "status": "success",
        "warnings": ir_warnings,
        "files": files,
    });

    fs::write(&output_path, serde_json::to_string_pretty(&result).unwrap()).unwrap();
}

#[test]
fn compile_simple_cron_http() {
    compile_and_save("sample_simple_cron_http.json", "simple-cron-http");
}

#[test]
fn compile_webhook_parse_log() {
    compile_and_save("sample_webhook_parse_log.json", "webhook-parse-log");
}

#[test]
fn compile_filter_branching() {
    compile_and_save("sample_filter_branching.json", "filter-branching");
}

#[test]
fn compile_evm_minting_pipeline() {
    compile_and_save("sample_evm_minting_pipeline.json", "evm-minting-pipeline");
}
