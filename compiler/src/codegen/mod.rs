//! Codegen pass: WorkflowIR → CRE TypeScript project bundle.
//!
//! Public API: `codegen(ir) -> CodegenOutput`

mod writer;
mod value_expr;
mod imports;
mod config_schema;
mod fetch_fns;
mod handler;
mod operations;
mod trigger;
mod files;

use crate::ir::types::WorkflowIR;
use writer::CodeWriter;

/// A generated file with its path and content.
#[derive(Debug, Clone)]
pub struct GeneratedFile {
    pub path: String,
    pub content: String,
}

/// The complete output of the codegen pass.
#[derive(Debug, Clone)]
pub struct CodegenOutput {
    pub files: Vec<GeneratedFile>,
}

/// Generate a complete CRE TypeScript project from a validated WorkflowIR.
pub fn codegen(ir: &WorkflowIR) -> CodegenOutput {
    let mut output_files = Vec::new();

    // Generate main.ts
    let main_ts = gen_main_ts(ir);
    output_files.push(GeneratedFile {
        path: "main.ts".into(),
        content: main_ts,
    });

    // Generate supporting files
    let env = if ir.metadata.is_testnet { "staging" } else { "production" };
    output_files.push(GeneratedFile {
        path: format!("config.{env}.json"),
        content: files::gen_config_json(ir),
    });
    output_files.push(GeneratedFile {
        path: "secrets.yaml".into(),
        content: files::gen_secrets_yaml(ir),
    });
    output_files.push(GeneratedFile {
        path: "workflow.yaml".into(),
        content: files::gen_workflow_yaml(ir),
    });
    output_files.push(GeneratedFile {
        path: "project.yaml".into(),
        content: files::gen_project_yaml(ir),
    });
    output_files.push(GeneratedFile {
        path: "package.json".into(),
        content: files::gen_package_json(ir),
    });
    output_files.push(GeneratedFile {
        path: "tsconfig.json".into(),
        content: files::gen_tsconfig_json(),
    });
    output_files.push(GeneratedFile {
        path: ".env".into(),
        content: files::gen_dot_env(ir),
    });

    CodegenOutput {
        files: output_files,
    }
}

/// Generate the `main.ts` file content.
fn gen_main_ts(ir: &WorkflowIR) -> String {
    let mut w = CodeWriter::new();

    // 1. IMPORTS
    let import_set = imports::collect_imports(ir);
    imports::emit_imports(&import_set, &mut w);
    w.blank();

    // 2. CONFIG SCHEMA
    config_schema::emit_config_schema(&ir.config_schema, &mut w);
    w.blank();

    // 3. FETCH FUNCTIONS (top-level, before handler)
    let fetch_fns = fetch_fns::collect_fetch_fns(&ir.handler_body);
    if !fetch_fns.is_empty() {
        fetch_fns::emit_fetch_fns(&fetch_fns, &mut w);
    }

    // 4. HANDLER
    handler::emit_handler(ir, &mut w);
    w.blank();

    // 5. INIT WORKFLOW + MAIN
    trigger::emit_init_and_main(ir, &mut w);

    w.finish()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codegen_produces_all_files() {
        use crate::ir::types::*;

        let ir = WorkflowIR {
            metadata: WorkflowMetadata {
                id: "test-workflow".into(),
                name: "Test Workflow".into(),
                description: None,
                version: "1.0.0".into(),
                is_testnet: true,
                default_chain_selector: None,
            },
            trigger: TriggerDef::Cron(CronTriggerDef {
                schedule: ValueExpr::config("schedule"),
            }),
            trigger_param: TriggerParam::CronTrigger,
            config_schema: vec![ConfigField {
                name: "schedule".into(),
                zod_type: ZodType::String,
                default_value: Some("*/5 * * * *".into()),
                description: None,
            }],
            required_secrets: vec![],
            evm_chains: vec![],
            user_rpcs: vec![],
            handler_body: Block {
                steps: vec![Step {
                    id: "return-1".into(),
                    source_node_ids: vec!["return-1".into()],
                    label: "Return success".into(),
                    operation: Operation::Return(ReturnOp {
                        expression: ValueExpr::string("done"),
                    }),
                    output: None,
                }],
            },
        };

        let output = codegen(&ir);
        let file_paths: Vec<&str> = output.files.iter().map(|f| f.path.as_str()).collect();

        assert!(file_paths.contains(&"main.ts"));
        assert!(file_paths.contains(&"config.staging.json"));
        assert!(file_paths.contains(&"secrets.yaml"));
        assert!(file_paths.contains(&"workflow.yaml"));
        assert!(file_paths.contains(&"project.yaml"));
        assert!(file_paths.contains(&"package.json"));
        assert!(file_paths.contains(&"tsconfig.json"));
        assert!(file_paths.contains(&".env"));
    }
}
