//! Emit the handler function body.
//!
//! Iterates over a Block's steps and emits TypeScript for each operation,
//! with special handling for Branch/Merge diamond patterns and Filter/Skip wrapping.

use crate::ir::types::*;
use super::operations;
use super::value_expr::emit_condition;
use super::writer::CodeWriter;

/// Emit the handler function signature and body.
pub fn emit_handler(ir: &WorkflowIR, w: &mut CodeWriter) {
    let (handler_name, trigger_type, trigger_param) = match &ir.trigger_param {
        TriggerParam::CronTrigger => ("onCronTrigger", "CronTrigger", "triggerData"),
        TriggerParam::HttpRequest => ("onHttpRequest", "HTTPRequest", "triggerData"),
        TriggerParam::EvmLog => ("onLogTrigger", "EVMLog", "triggerData"),
        TriggerParam::None => ("onTrigger", "", ""),
    };

    if trigger_param.is_empty() {
        w.block_open(&format!(
            "const {} = (runtime: Runtime<Config>): string =>",
            handler_name
        ));
    } else {
        w.block_open(&format!(
            "const {} = (runtime: Runtime<Config>, {}: {}): string =>",
            handler_name, trigger_param, trigger_type
        ));
    }

    // Instantiate capabilities used in the handler
    emit_capability_instantiations(ir, w);
    w.blank();

    // Emit the block
    emit_block(&ir.handler_body, w);

    w.block_close_semi();
}

fn emit_capability_instantiations(ir: &WorkflowIR, w: &mut CodeWriter) {
    // HTTP client (if any HttpRequest or AiCall steps)
    if has_http_steps(&ir.handler_body) {
        w.line("const httpClient = new cre.capabilities.HTTPClient();");
    }

    // EVM clients
    for chain in &ir.evm_chains {
        if !chain.used_for_trigger {
            w.line(&format!(
                "const {} = new cre.capabilities.EVMClient(getNetwork({{ chainFamily: \"evm\", chainSelectorName: \"{}\", isTestnet: {} }})!.chainSelector.selector);",
                chain.binding_name,
                chain.chain_selector_name,
                ir.metadata.is_testnet,
            ));
        }
    }
}

fn has_http_steps(block: &Block) -> bool {
    block.steps.iter().any(|s| match &s.operation {
        Operation::HttpRequest(_) | Operation::AiCall(_) => true,
        Operation::Branch(b) => {
            has_http_steps(&b.true_branch) || has_http_steps(&b.false_branch)
        }
        _ => false,
    })
}

/// Emit a block of steps. Handles Branch/Merge coupling and Filter/Skip wrapping.
pub fn emit_block(block: &Block, w: &mut CodeWriter) {
    let steps = &block.steps;
    let mut i = 0;

    while i < steps.len() {
        let step = &steps[i];

        match &step.operation {
            Operation::Branch(branch) => {
                emit_branch(step, branch, w);
                // If there's a reconverge_at, skip the next Merge step
                if branch.reconverge_at.is_some() && i + 1 < steps.len() {
                    if let Operation::Merge(_) = &steps[i + 1].operation {
                        i += 1; // skip the Merge
                    }
                }
            }
            Operation::Filter(filter) => {
                match &filter.non_match_behavior {
                    FilterNonMatchBehavior::EarlyReturn { message } => {
                        emit_filter_early_return(filter, message, w);
                    }
                    FilterNonMatchBehavior::Skip => {
                        // Wrap remaining steps in if (condition) { ... }
                        let cond = emit_condition(&filter.conditions, &filter.combine_with);
                        w.block_open(&format!("if ({})", cond));
                        // Emit all remaining steps in this block inside the if
                        let remaining = Block {
                            steps: steps[i + 1..].to_vec(),
                        };
                        emit_block(&remaining, w);
                        w.block_close();
                        return; // We've consumed all remaining steps
                    }
                }
            }
            Operation::Merge(_) => {
                // Standalone Merge (shouldn't happen if Branch handled it, but be safe)
                // Skip — already handled by Branch emitter
            }
            Operation::HttpRequest(op) => {
                operations::emit_http_request(step, op, w);
            }
            Operation::EvmRead(op) => {
                operations::emit_evm_read(step, op, w);
            }
            Operation::EvmWrite(op) => {
                operations::emit_evm_write(step, op, w);
            }
            Operation::GetSecret(op) => {
                operations::emit_get_secret(step, op, w);
            }
            Operation::CodeNode(op) => {
                operations::emit_code_node(step, op, w);
            }
            Operation::JsonParse(op) => {
                operations::emit_json_parse(step, op, w);
            }
            Operation::AbiEncode(op) => {
                operations::emit_abi_encode(step, op, w);
            }
            Operation::AbiDecode(op) => {
                operations::emit_abi_decode(step, op, w);
            }
            Operation::AiCall(op) => {
                operations::emit_ai_call(step, op, w);
            }
            Operation::Log(op) => {
                operations::emit_log(step, op, w);
            }
            Operation::ErrorThrow(op) => {
                operations::emit_error_throw(step, op, w);
            }
            Operation::Return(op) => {
                operations::emit_return(step, op, w);
            }
        }

        i += 1;
    }
}

fn emit_branch(step: &Step, branch: &BranchOp, w: &mut CodeWriter) {
    let cond = emit_condition(&branch.conditions, &branch.combine_with);

    w.line(&format!("// {}", step.label));

    // For diamond pattern (reconverge_at is Some), declare `let` variable before if/else
    if let Some(ref merge_id) = branch.reconverge_at {
        // Find the merge step's output to get the variable name and type
        // The merge step should follow this branch step in the parent block
        w.line(&format!("let step_{};", merge_id.replace('-', "_")));
    }

    w.block_open(&format!("if ({})", cond));
    emit_block(&branch.true_branch, w);

    w.block_else();
    emit_block(&branch.false_branch, w);

    w.block_close();
}

fn emit_filter_early_return(filter: &FilterOp, message: &str, w: &mut CodeWriter) {
    let cond = emit_condition(&filter.conditions, &filter.combine_with);
    w.block_open(&format!("if (!({}))", cond));
    w.line(&format!(r#"return "{}";"#, message.replace('"', "\\\"")));
    w.block_close();
}
