//! Integration tests for the codegen pass.

mod helpers;

use compiler::codegen::codegen;
use compiler::ir::*;

#[test]
fn branching_workflow_codegen_main_ts_snapshot() {
    let ir = helpers::branching_workflow_ir();
    let output = codegen(&ir);

    let main_ts = output
        .files
        .iter()
        .find(|f| f.path == "main.ts")
        .expect("main.ts should be generated");

    insta::assert_snapshot!("branching_workflow_main_ts", main_ts.content);
}

#[test]
fn branching_workflow_codegen_config_json_snapshot() {
    let ir = helpers::branching_workflow_ir();
    let output = codegen(&ir);

    let config = output
        .files
        .iter()
        .find(|f| f.path == "config.staging.json")
        .expect("config.staging.json should be generated");

    insta::assert_snapshot!("branching_workflow_config_json", config.content);
}

#[test]
fn branching_workflow_codegen_secrets_yaml_snapshot() {
    let ir = helpers::branching_workflow_ir();
    let output = codegen(&ir);

    let secrets = output
        .files
        .iter()
        .find(|f| f.path == "secrets.yaml")
        .expect("secrets.yaml should be generated");

    insta::assert_snapshot!("branching_workflow_secrets_yaml", secrets.content);
}

#[test]
fn branching_workflow_codegen_package_json_snapshot() {
    let ir = helpers::branching_workflow_ir();
    let output = codegen(&ir);

    let pkg = output
        .files
        .iter()
        .find(|f| f.path == "package.json")
        .expect("package.json should be generated");

    insta::assert_snapshot!("branching_workflow_package_json", pkg.content);
}

#[test]
fn branching_workflow_codegen_produces_all_files() {
    let ir = helpers::branching_workflow_ir();
    let output = codegen(&ir);

    let paths: Vec<&str> = output.files.iter().map(|f| f.path.as_str()).collect();
    assert!(paths.contains(&"main.ts"));
    assert!(paths.contains(&"config.staging.json"));
    assert!(paths.contains(&"secrets.yaml"));
    assert!(paths.contains(&"workflow.yaml"));
    assert!(paths.contains(&"project.yaml"));
    assert!(paths.contains(&"package.json"));
    assert!(paths.contains(&"tsconfig.json"));
    assert!(paths.contains(&".env"));
    assert_eq!(output.files.len(), 8);
}

#[test]
fn minimal_workflow_codegen() {
    let ir = helpers::base_ir();
    let output = codegen(&ir);

    let main_ts = output
        .files
        .iter()
        .find(|f| f.path == "main.ts")
        .expect("main.ts should be generated");

    // Should contain basic structure
    assert!(main_ts.content.contains("import"));
    assert!(main_ts.content.contains("configSchema"));
    assert!(main_ts.content.contains("onCronTrigger"));
    assert!(main_ts.content.contains("initWorkflow"));
    assert!(main_ts.content.contains("Runner.newRunner"));
    assert!(main_ts.content.contains("main()"));
}

#[test]
fn ai_call_with_upstream_refs_uses_augmented_config() {
    let ir = helpers::ir_with_steps_and_deps(
        vec![
            helpers::make_step_with_output(
                "http-1",
                helpers::http_get("https://api.example.com/data"),
                "{ statusCode: number; body: any; headers: Record<string, string> }",
            ),
            helpers::make_step_with_output(
                "ai-1",
                helpers::ai_call_op_with_refs(
                    "openai",
                    "OPENAI_KEY",
                    ValueExpr::string("You are a helpful assistant."),
                    ValueExpr::Template {
                        parts: vec![
                            TemplatePart::Lit { value: "Analyze: ".into() },
                            TemplatePart::Expr {
                                value: ValueExpr::binding("http-1", "body.value"),
                            },
                        ],
                    },
                ),
                "any",
            ),
        ],
        vec![("OPENAI_KEY", "OPENAI_KEY_VAR")],
        vec![],
    );
    let output = codegen(&ir);
    let main_ts = output
        .files
        .iter()
        .find(|f| f.path == "main.ts")
        .expect("main.ts should be generated");

    // The fetch function should use config._dyn0 instead of free variable
    assert!(
        main_ts.content.contains("config._dyn0"),
        "AI fetch fn should substitute upstream ref with config._dyn0, got:\n{}",
        main_ts.content
    );
    // The handler should build an augmented config
    assert!(
        main_ts.content.contains("_fetchCfg_ai_1"),
        "Handler should build augmented config for AI call, got:\n{}",
        main_ts.content
    );
    // The augmented config should contain the upstream ref
    assert!(
        main_ts.content.contains("step_http_1.body.value"),
        "Augmented config should pass upstream step value, got:\n{}",
        main_ts.content
    );
    // Should NOT contain free variable reference in fetch function
    // (the fetch fn uses config._dyn0, not a handler-local upstream value)
}
