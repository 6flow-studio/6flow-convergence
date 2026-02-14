//! Generate supporting project files: config.json, secrets.yaml, workflow.yaml,
//! project.yaml, package.json, tsconfig.json, .env.

use crate::ir::types::*;

/// Generate `config.json` content.
pub fn gen_config_json(ir: &WorkflowIR) -> String {
    let mut entries: Vec<String> = Vec::new();
    for field in &ir.config_schema {
        let value = match &field.default_value {
            Some(v) => match &field.zod_type {
                ZodType::String => format!("\"{}\"", v.replace('"', "\\\"")),
                ZodType::Number | ZodType::Boolean => v.clone(),
                ZodType::Raw(_) => v.clone(),
            },
            None => match &field.zod_type {
                ZodType::String => "\"\"".to_string(),
                ZodType::Number => "0".to_string(),
                ZodType::Boolean => "false".to_string(),
                ZodType::Raw(_) => "null".to_string(),
            },
        };
        entries.push(format!("  \"{}\": {}", field.name, value));
    }
    format!("{{\n{}\n}}\n", entries.join(",\n"))
}

/// Generate `secrets.yaml` content.
pub fn gen_secrets_yaml(ir: &WorkflowIR) -> String {
    if ir.required_secrets.is_empty() {
        return "secretsNames: {}\n".to_string();
    }
    let mut lines = vec!["secretsNames:".to_string()];
    for secret in &ir.required_secrets {
        lines.push(format!("  {}:", secret.name));
        lines.push(format!("    - {}", secret.env_variable));
    }
    lines.push(String::new());
    lines.join("\n")
}

/// Generate `workflow.yaml` content.
pub fn gen_workflow_yaml(ir: &WorkflowIR) -> String {
    let id = &ir.metadata.id;
    format!(
        r#"staging-settings:
  user-workflow:
    workflow-name: "{id}-staging"
  workflow-artifacts:
    workflow-path: "./main.ts"
    config-path: "./config.json"
    secrets-path: "../secrets.yaml"
production-settings:
  user-workflow:
    workflow-name: "{id}-production"
  workflow-artifacts:
    workflow-path: "./main.ts"
    config-path: "./config.json"
    secrets-path: "../secrets.yaml"
"#
    )
}

/// Generate `project.yaml` content.
pub fn gen_project_yaml(ir: &WorkflowIR) -> String {
    let mut rpc_lines = String::new();
    for chain in &ir.evm_chains {
        rpc_lines.push_str(&format!(
            "    - chain-name: {}\n      url: https://0xrpc.io/sep\n",
            chain.chain_selector_name
        ));
    }

    // If there are EVM log triggers, include that chain too
    if let TriggerDef::EvmLog(evm_log) = &ir.trigger {
        let trigger_chain = evm_log.evm_client_binding.replace("evmClient_", "").replace('_', "-");
        // Only add if not already in evm_chains
        let already_exists = ir.evm_chains.iter().any(|c| c.chain_selector_name == trigger_chain);
        if !already_exists {
            rpc_lines.push_str(&format!(
                "    - chain-name: {}\n      url: https://0xrpc.io/sep\n",
                trigger_chain
            ));
        }
    }

    if rpc_lines.is_empty() {
        return "staging-settings:\n  rpcs: []\n".to_string();
    }

    format!(
        "staging-settings:\n  rpcs:\n{}",
        rpc_lines
    )
}

/// Generate `package.json` content.
pub fn gen_package_json(ir: &WorkflowIR) -> String {
    let name = &ir.metadata.id;
    let mut deps = vec![
        ("@chainlink/cre-sdk", "^1.0.10"),
        ("zod", "^3.24"),
    ];

    // Check if viem is needed
    if needs_viem(ir) {
        deps.push(("viem", "^2.0"));
    }

    let dep_entries: Vec<String> = deps
        .iter()
        .map(|(k, v)| format!("    \"{}\": \"{}\"", k, v))
        .collect();

    let dev_dep_entries = vec![
        format!("    \"@types/bun\": \"1.2.21\""),
    ];

    format!(
        r#"{{
  "name": "{name}",
  "version": "1.0.0",
  "main": "dist/main.js",
  "private": true,
  "scripts": {{
    "postinstall": "bun x cre-setup"
  }},
  "dependencies": {{
{deps}
  }},
  "devDependencies": {{
{dev_deps}
  }}
}}
"#,
        deps = dep_entries.join(",\n"),
        dev_deps = dev_dep_entries.join(",\n")
    )
}

/// Generate `tsconfig.json` content.
pub fn gen_tsconfig_json() -> String {
    r#"{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["*.ts"]
}
"#.to_string()
}

/// Generate `.env` content for local CRE simulation.
pub fn gen_dot_env(ir: &WorkflowIR) -> String {
    let mut lines = vec![
        "# Environment variables for CRE simulation".to_string(),
        "# Fill in real values before running `cre simulate`".to_string(),
    ];
    if ir.required_secrets.is_empty() {
        lines.push("# No secrets required for this workflow".to_string());
    } else {
        lines.push(String::new());
        for secret in &ir.required_secrets {
            lines.push(format!("{}=<{}>", secret.env_variable, secret.name));
        }
    }
    lines.push(String::new());
    lines.join("\n")
}

fn needs_viem(ir: &WorkflowIR) -> bool {
    has_viem_ops(&ir.handler_body)
        || matches!(&ir.trigger, TriggerDef::EvmLog(_))
}

fn has_viem_ops(block: &Block) -> bool {
    block.steps.iter().any(|s| match &s.operation {
        Operation::EvmRead(_) | Operation::EvmWrite(_) => true,
        Operation::AbiEncode(_) | Operation::AbiDecode(_) => true,
        Operation::Branch(b) => has_viem_ops(&b.true_branch) || has_viem_ops(&b.false_branch),
        _ => false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_json_with_defaults() {
        let ir = WorkflowIR {
            metadata: WorkflowMetadata {
                id: "test".into(),
                name: "Test".into(),
                description: None,
                version: "1.0.0".into(),
                is_testnet: true,
                default_chain_selector: None,
            },
            trigger: TriggerDef::Cron(CronTriggerDef {
                schedule: ValueExpr::string("*/5 * * * *"),
                timezone: None,
            }),
            trigger_param: TriggerParam::CronTrigger,
            config_schema: vec![
                ConfigField {
                    name: "schedule".into(),
                    zod_type: ZodType::String,
                    default_value: Some("*/5 * * * *".into()),
                    description: None,
                },
                ConfigField {
                    name: "threshold".into(),
                    zod_type: ZodType::Number,
                    default_value: None,
                    description: None,
                },
            ],
            required_secrets: vec![],
            evm_chains: vec![],
            handler_body: Block { steps: vec![] },
        };

        let json = gen_config_json(&ir);
        assert!(json.contains("\"schedule\": \"*/5 * * * *\""));
        assert!(json.contains("\"threshold\": 0"));
    }

    #[test]
    fn secrets_yaml_output() {
        let ir = WorkflowIR {
            metadata: WorkflowMetadata {
                id: "test".into(),
                name: "Test".into(),
                description: None,
                version: "1.0.0".into(),
                is_testnet: true,
                default_chain_selector: None,
            },
            trigger: TriggerDef::Cron(CronTriggerDef {
                schedule: ValueExpr::string("*"),
                timezone: None,
            }),
            trigger_param: TriggerParam::CronTrigger,
            config_schema: vec![],
            required_secrets: vec![SecretDeclaration {
                name: "API_KEY".into(),
                env_variable: "API_KEY_VAR".into(),
            }],
            evm_chains: vec![],
            handler_body: Block { steps: vec![] },
        };

        let yaml = gen_secrets_yaml(&ir);
        assert!(yaml.contains("secretsNames:"));
        assert!(yaml.contains("  API_KEY:"));
        assert!(yaml.contains("    - API_KEY_VAR"));
    }

    #[test]
    fn dot_env_with_secrets() {
        let ir = WorkflowIR {
            metadata: WorkflowMetadata {
                id: "test".into(),
                name: "Test".into(),
                description: None,
                version: "1.0.0".into(),
                is_testnet: true,
                default_chain_selector: None,
            },
            trigger: TriggerDef::Cron(CronTriggerDef {
                schedule: ValueExpr::string("*"),
                timezone: None,
            }),
            trigger_param: TriggerParam::CronTrigger,
            config_schema: vec![],
            required_secrets: vec![
                SecretDeclaration {
                    name: "API_KEY".into(),
                    env_variable: "API_KEY_VAR".into(),
                },
                SecretDeclaration {
                    name: "DB_PASSWORD".into(),
                    env_variable: "DB_PASSWORD_VAR".into(),
                },
            ],
            evm_chains: vec![],
            handler_body: Block { steps: vec![] },
        };

        let env = gen_dot_env(&ir);
        assert!(env.contains("API_KEY_VAR=<API_KEY>"));
        assert!(env.contains("DB_PASSWORD_VAR=<DB_PASSWORD>"));
    }

    #[test]
    fn dot_env_without_secrets() {
        let ir = WorkflowIR {
            metadata: WorkflowMetadata {
                id: "test".into(),
                name: "Test".into(),
                description: None,
                version: "1.0.0".into(),
                is_testnet: true,
                default_chain_selector: None,
            },
            trigger: TriggerDef::Cron(CronTriggerDef {
                schedule: ValueExpr::string("*"),
                timezone: None,
            }),
            trigger_param: TriggerParam::CronTrigger,
            config_schema: vec![],
            required_secrets: vec![],
            evm_chains: vec![],
            handler_body: Block { steps: vec![] },
        };

        let env = gen_dot_env(&ir);
        assert!(env.contains("No secrets required"));
        assert!(!env.contains("=<"));
    }

    #[test]
    fn package_json_includes_viem_when_needed() {
        let ir = WorkflowIR {
            metadata: WorkflowMetadata {
                id: "test".into(),
                name: "Test".into(),
                description: None,
                version: "1.0.0".into(),
                is_testnet: true,
                default_chain_selector: None,
            },
            trigger: TriggerDef::Cron(CronTriggerDef {
                schedule: ValueExpr::string("*"),
                timezone: None,
            }),
            trigger_param: TriggerParam::CronTrigger,
            config_schema: vec![],
            required_secrets: vec![],
            evm_chains: vec![],
            handler_body: Block {
                steps: vec![Step {
                    id: "abi-1".into(),
                    source_node_ids: vec![],
                    label: "encode".into(),
                    operation: Operation::AbiEncode(AbiEncodeOp {
                        abi_params_json: "test".into(),
                        data_mappings: vec![],
                    }),
                    output: None,
                }],
            },
        };

        let pkg = gen_package_json(&ir);
        assert!(pkg.contains("viem"));
    }
}
