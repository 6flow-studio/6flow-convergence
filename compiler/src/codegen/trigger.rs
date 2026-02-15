//! Emit `initWorkflow` and `main()` entry point.

use crate::ir::types::*;
use super::value_expr::emit_value_expr_init;
use super::writer::CodeWriter;

/// Emit the `initWorkflow` function and `main()` entry point.
pub fn emit_init_and_main(ir: &WorkflowIR, w: &mut CodeWriter) {
    emit_init_workflow(ir, w);
    w.blank();
    emit_main(ir, w);
}

fn emit_init_workflow(ir: &WorkflowIR, w: &mut CodeWriter) {
    let handler_name = match &ir.trigger_param {
        TriggerParam::CronTrigger => "onCronTrigger",
        TriggerParam::HttpRequest => "onHttpRequest",
        TriggerParam::EvmLog => "onLogTrigger",
        TriggerParam::None => "onTrigger",
    };

    w.block_open("const initWorkflow = (config: Config) =>");

    match &ir.trigger {
        TriggerDef::Cron(cron) => emit_cron_init(cron, handler_name, w),
        TriggerDef::Http(http) => emit_http_init(http, handler_name, w),
        TriggerDef::EvmLog(evm_log) => emit_evm_log_init(evm_log, ir, handler_name, w),
    }

    w.block_close_semi();
}

fn emit_cron_init(cron: &CronTriggerDef, handler_name: &str, w: &mut CodeWriter) {
    w.line("return [");
    w.indent();
    w.line("cre.handler(");
    w.indent();
    w.line("new cre.capabilities.CronCapability().trigger({");
    w.indent();
    w.line(&format!("schedule: {},", emit_value_expr_init(&cron.schedule)));
    w.dedent();
    w.line("}),");
    w.line(&format!("{},", handler_name));
    w.dedent();
    w.line("),");
    w.dedent();
    w.line("];");
}

fn emit_http_init(http: &HttpTriggerDef, handler_name: &str, w: &mut CodeWriter) {
    w.line("return [");
    w.indent();
    w.line("cre.handler(");
    w.indent();
    w.line("new cre.capabilities.HTTPCapability().trigger({");
    w.indent();
    w.line(&format!("path: {},", emit_value_expr_init(&http.path)));
    w.line(&format!(
        "methods: [{}],",
        http.methods.iter().map(|m| format!("\"{}\"", m)).collect::<Vec<_>>().join(", ")
    ));
    w.dedent();
    w.line("}),");
    w.line(&format!("{},", handler_name));
    w.dedent();
    w.line("),");
    w.dedent();
    w.line("];");
}

fn emit_evm_log_init(evm_log: &EvmLogTriggerDef, ir: &WorkflowIR, handler_name: &str, w: &mut CodeWriter) {
    // Find the chain for the trigger
    w.line(&format!(
        "const network = getNetwork({{ chainFamily: \"evm\", chainSelectorName: \"{}\", isTestnet: {} }});",
        evm_log.evm_client_binding.replace("evmClient_", "").replace('_', "-"),
        ir.metadata.is_testnet,
    ));
    w.blank();
    w.block_open("if (!network)");
    w.line(&format!(
        "throw new Error(\"Network not found for chain selector\");",
    ));
    w.block_close();
    w.blank();
    w.line("const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);");
    w.blank();

    // Event topic hash
    w.line(&format!(
        "const eventTopicHash = keccak256(toHex(\"{}\"));",
        evm_log.event_signature
    ));
    w.blank();

    w.line("return [");
    w.indent();
    w.line("cre.handler(");
    w.indent();
    w.line("evmClient.logTrigger({");
    w.indent();

    // Addresses
    let addrs: Vec<String> = evm_log.contract_addresses.iter().map(|a| emit_value_expr_init(a)).collect();
    w.line(&format!("addresses: [{}],", addrs.join(", ")));

    // Topics
    if evm_log.topic_filters.is_empty() {
        w.line("topics: [{ values: [eventTopicHash] }],");
    } else {
        w.line("topics: [");
        w.indent();
        w.line("{ values: [eventTopicHash] },");
        for filter in &evm_log.topic_filters {
            let values: Vec<String> = filter.values.iter().map(|v| format!("\"{}\"", v)).collect();
            w.line(&format!("{{ values: [{}] }},", values.join(", ")));
        }
        w.dedent();
        w.line("],");
    }

    w.line(&format!("confidence: \"{}\",", evm_log.confidence));

    w.dedent();
    w.line("}),");
    w.line(&format!("{},", handler_name));
    w.dedent();
    w.line("),");
    w.dedent();
    w.line("];");
}

fn emit_main(ir: &WorkflowIR, w: &mut CodeWriter) {
    w.block_open("export async function main()");
    if ir.config_schema.is_empty() {
        w.line("const runner = await Runner.newRunner<Config>();");
    } else {
        w.line("const runner = await Runner.newRunner<Config>({ configSchema });");
    }
    w.line("await runner.run(initWorkflow);");
    w.block_close();
    w.blank();
    w.line("main();");
}
