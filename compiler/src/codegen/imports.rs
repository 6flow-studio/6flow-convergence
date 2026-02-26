//! Scan the IR to determine which imports are needed and emit them.

use super::writer::CodeWriter;
use crate::ir::types::*;

/// Tracks which symbols are needed from each package.
#[derive(Default)]
pub struct ImportSet {
    // @chainlink/cre-sdk
    pub cre: bool,
    pub runtime_type: bool,
    pub runner: bool,
    pub http_send_requester_type: bool,
    pub consensus_identical: bool,
    pub consensus_by_fields: bool,
    pub ok_fn: bool,
    pub cron_trigger_type: bool,
    pub http_payload_type: bool,
    pub evm_log_type: bool,
    pub get_network: bool,
    pub bytes_to_hex: bool,

    // viem
    pub encode_function_data: bool,
    pub decode_function_result: bool,
    pub parse_abi: bool,
    pub keccak256: bool,
    pub to_hex: bool,
    pub decode_event_log: bool,

    // zod
    pub zod: bool,
}

/// Scan the IR and collect all needed imports.
pub fn collect_imports(ir: &WorkflowIR) -> ImportSet {
    let mut imports = ImportSet::default();

    // Always needed
    imports.cre = true;
    imports.runtime_type = true;
    imports.runner = true;
    imports.zod = !ir.config_schema.is_empty();

    // Trigger-specific
    match &ir.trigger_param {
        TriggerParam::CronTrigger => imports.cron_trigger_type = true,
        TriggerParam::HttpRequest => imports.http_payload_type = true,
        TriggerParam::EvmLog => {
            imports.evm_log_type = true;
            imports.get_network = true;
            imports.bytes_to_hex = true;
            imports.keccak256 = true;
            imports.to_hex = true;
            imports.decode_event_log = true;
        }
        _ => {}
    }

    // EVM chains in handler need getNetwork
    if !ir.evm_chains.is_empty() {
        imports.get_network = true;
    }

    // Scan handler body
    scan_block(&ir.handler_body, &mut imports);

    imports
}

fn scan_block(block: &Block, imports: &mut ImportSet) {
    for step in &block.steps {
        scan_operation(&step.operation, imports);
    }
}

fn scan_operation(op: &Operation, imports: &mut ImportSet) {
    match op {
        Operation::HttpRequest(http) => {
            imports.http_send_requester_type = true;
            imports.ok_fn = true;
            match &http.consensus {
                ConsensusStrategy::Identical => imports.consensus_identical = true,
                ConsensusStrategy::MedianByFields { .. } => imports.consensus_by_fields = true,
                ConsensusStrategy::Custom { .. } => {}
            }
        }
        Operation::AiCall(ai) => {
            imports.http_send_requester_type = true;
            imports.ok_fn = true;
            match &ai.consensus {
                ConsensusStrategy::Identical => imports.consensus_identical = true,
                ConsensusStrategy::MedianByFields { .. } => imports.consensus_by_fields = true,
                ConsensusStrategy::Custom { .. } => {}
            }
        }
        Operation::AbiEncode(_) => {
            imports.encode_function_data = true;
        }
        Operation::AbiDecode(_) => {
            imports.decode_function_result = true;
        }
        Operation::Branch(branch) => {
            scan_block(&branch.true_branch, imports);
            scan_block(&branch.false_branch, imports);
        }
        _ => {}
    }
}

/// Emit the import statements to the writer.
pub fn emit_imports(imports: &ImportSet, w: &mut CodeWriter) {
    // @chainlink/cre-sdk
    let mut sdk_items: Vec<&str> = Vec::new();
    if imports.cre {
        sdk_items.push("cre");
    }
    if imports.ok_fn {
        sdk_items.push("ok");
    }
    if imports.consensus_identical {
        sdk_items.push("consensusIdenticalAggregation");
    }
    if imports.get_network {
        sdk_items.push("getNetwork");
    }
    if imports.bytes_to_hex {
        sdk_items.push("bytesToHex");
    }

    let mut sdk_types: Vec<&str> = Vec::new();
    if imports.runtime_type {
        sdk_types.push("type Runtime");
    }
    if imports.http_send_requester_type {
        sdk_types.push("type HTTPSendRequester");
    }
    if imports.cron_trigger_type {
        sdk_types.push("type CronTrigger");
    }
    if imports.http_payload_type {
        sdk_types.push("type HTTPPayload");
    }
    if imports.evm_log_type {
        sdk_types.push("EVMLog");
    }

    // Runner is always last
    if imports.runner {
        sdk_items.push("Runner");
    }

    let all_sdk: Vec<&str> = sdk_items.into_iter().chain(sdk_types).collect();
    if !all_sdk.is_empty() {
        w.line(&format!(
            "import {{ {} }} from \"@chainlink/cre-sdk\";",
            all_sdk.join(", ")
        ));
    }

    // viem
    let mut viem_items: Vec<&str> = Vec::new();
    if imports.keccak256 {
        viem_items.push("keccak256");
    }
    if imports.to_hex {
        viem_items.push("toHex");
    }
    if imports.encode_function_data {
        viem_items.push("encodeFunctionData");
    }
    if imports.decode_function_result {
        viem_items.push("decodeFunctionResult");
    }
    if imports.decode_event_log {
        viem_items.push("decodeEventLog");
    }
    if imports.parse_abi {
        viem_items.push("parseAbi");
    }
    if !viem_items.is_empty() {
        w.line(&format!(
            "import {{ {} }} from \"viem\";",
            viem_items.join(", ")
        ));
    }

    // zod
    if imports.zod {
        w.line("import { z } from \"zod\";");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn minimal_cron_imports() {
        let mut imports = ImportSet::default();
        imports.cre = true;
        imports.runtime_type = true;
        imports.runner = true;
        imports.cron_trigger_type = true;
        imports.zod = true;

        let mut w = CodeWriter::new();
        emit_imports(&imports, &mut w);
        let out = w.finish();

        assert!(out.contains("cre"));
        assert!(out.contains("Runner"));
        assert!(out.contains("type Runtime"));
        assert!(out.contains("type CronTrigger"));
        assert!(out.contains("from \"@chainlink/cre-sdk\""));
        assert!(out.contains("from \"zod\""));
        assert!(!out.contains("viem"));
    }

    #[test]
    fn http_request_adds_send_requester_and_ok() {
        let mut imports = ImportSet::default();
        imports.cre = true;
        imports.runtime_type = true;
        imports.runner = true;
        imports.http_send_requester_type = true;
        imports.ok_fn = true;
        imports.consensus_identical = true;

        let mut w = CodeWriter::new();
        emit_imports(&imports, &mut w);
        let out = w.finish();

        assert!(out.contains("ok"));
        assert!(out.contains("consensusIdenticalAggregation"));
        assert!(out.contains("type HTTPSendRequester"));
    }
}
