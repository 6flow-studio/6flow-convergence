//! Integration tests for the codegen pass.

mod helpers;

use compiler::codegen::codegen;

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
