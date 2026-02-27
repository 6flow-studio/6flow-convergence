//! Integration test: KYC-Gated Token Minting workflow.
//!
//! This is the canonical example from `shared/model/node.ts`.
//! Visual graph:
//!   [cronTrigger] → [httpRequest] → [jsonParse] → [if]
//!                                                   ├─ true → [abiEncode] → [evmWrite] → [return]
//!                                                   └─ false → [log] → [return]
//!
//! The mintToken convenience node has been pre-expanded into abiEncode + evmWrite.

mod helpers;

use compiler::ir::*;

#[test]
fn kyc_minting_ir_validates() {
    let ir = helpers::kyc_minting_ir();
    let errors = validate_ir(&ir);
    assert!(
        errors.is_empty(),
        "KYC minting IR should be valid, but got errors: {:#?}",
        errors
    );
}

#[test]
fn kyc_minting_ir_serializes_to_json() {
    let ir = helpers::kyc_minting_ir();
    let json = serde_json::to_string_pretty(&ir).expect("IR should serialize to JSON");

    // Verify it round-trips
    let deserialized: WorkflowIR =
        serde_json::from_str(&json).expect("IR JSON should deserialize back");
    assert_eq!(deserialized.metadata.id, "kyc-gated-minting");
    assert_eq!(deserialized.handler_body.steps.len(), 3);

    // Verify the branch structure
    if let Operation::Branch(branch) = &deserialized.handler_body.steps[2].operation {
        assert_eq!(branch.true_branch.steps.len(), 3); // encode, write, return
        assert_eq!(branch.false_branch.steps.len(), 1); // return
        assert!(branch.reconverge_at.is_none());
    } else {
        panic!("Step 2 should be a Branch");
    }
}

#[test]
fn kyc_minting_ir_snapshot() {
    let ir = helpers::kyc_minting_ir();
    insta::assert_json_snapshot!("kyc_minting_ir", ir);
}

/// Test that modifying the IR to break an invariant is caught.
#[test]
fn kyc_minting_undeclared_chain_fails() {
    let mut ir = helpers::kyc_minting_ir();
    ir.evm_chains.clear(); // Remove the chain declaration
    let errors = validate_ir(&ir);
    assert!(
        errors.iter().any(|e| e.code == "E008"),
        "Should fail with E008 for missing evm chain, got: {:#?}",
        errors
    );
}

#[test]
fn kyc_minting_undeclared_secret_fails() {
    let mut ir = helpers::kyc_minting_ir();
    ir.required_secrets.clear(); // Remove secret declaration
    let errors = validate_ir(&ir);
    assert!(
        errors.iter().any(|e| e.code == "E007"),
        "Should fail with E007 for missing secret, got: {:#?}",
        errors
    );
}
