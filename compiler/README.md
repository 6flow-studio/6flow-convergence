# 6Flow Compiler (Rust)

This crate is the compiler core for 6Flow workflows.

## IR overview

Top-level type: `WorkflowIR`

- `metadata: WorkflowMetadata`
- `trigger: TriggerDef` (`Cron`, `Http`, `EvmLog`)
- `trigger_param: TriggerParam`
- `config_schema: Vec<ConfigField>`
- `required_secrets: Vec<SecretDeclaration>`
- `evm_chains: Vec<EvmChainUsage>`
- `handler_body: Block`

Execution model:

- `Block` is an ordered list of `Step`.
- `Step` has:
  - `id`
  - `source_node_ids`
  - `label`
  - `operation: Operation`
  - `output: Option<OutputBinding>`

### Core data reference model

`ValueExpr` is the unified expression system used across operations:

- `Literal`
- `Binding` (reference prior step output)
- `ConfigRef`
- `TriggerDataRef`
- `Template`
- `RawExpr` (escape hatch)

### Operation families

`Operation` includes:

- CRE capabilities: `HttpRequest`, `EvmRead`, `EvmWrite`, `GetSecret`
- Transforms: `CodeNode`, `JsonParse`, `AbiEncode`, `AbiDecode`
- Control flow: `Branch`, `Filter`, `Merge`
- AI: `AiCall`
- Output/termination: `Log`, `ErrorThrow`, `Return`

## Validation

Validation entrypoint: `validate_ir(&WorkflowIR) -> Vec<ValidationError>`.

`ValidationError` fields:

- `code: &'static str`
- `message: String`
- `step_id: Option<String>`

### Capability budget limits

From `src/ir/validate.rs`:

- HTTP calls: max `5`
- EVM reads: max `10`
- EVM writes: max `5`

Branches are budget-counted by worst-case branch path (`max(true_branch, false_branch)`).

### Validation error codes

| Code | Meaning |
| --- | --- |
| `E001` | Handler body is empty (`handler_body.steps` must be non-empty). |
| `E002` | Duplicate `Step.id` found (must be globally unique, including nested branches). |
| `E003` | Invalid binding reference (not in scope / not forward-defined). |
| `E004` | `Branch.reconverge_at` is invalid because the merge is missing or not immediately next. |
| `E005` | Merge operation exists but `Merge.branch_step_id` does not match the branch step. |
| `E006` | Step at `reconverge_at` position is not a `Merge` operation. |
| `E007` | Secret referenced by an op is not declared in `required_secrets`. |
| `E008` | `evm_client_binding` referenced by trigger/step is not declared in `evm_chains`. |
| `E009` | HTTP call budget exceeded. |
| `E010` | EVM read budget exceeded. |
| `E011` | EVM write budget exceeded. |
| `E012` | Not all execution paths terminate with `Return` or `ErrorThrow`. |

## Tests

69 tests covering IR correctness, serde round-trips, and validation invariants.

### Test structure

| File | Tests | What it covers |
| --- | --- | --- |
| `src/ir/validate.rs` (inline) | 8 | Minimal valid IR, empty handler, dup IDs, forward/backward bindings, missing secret, missing return, budget exceeded |
| `tests/kyc_minting.rs` | 5 | Canonical KYC-gated minting IR: validation, JSON round-trip, snapshot (`insta`), undeclared secret/chain |
| `tests/helpers/mod.rs` | — | Shared test builders (`base_ir`, `ir_with_steps`, `make_step`, operation constructors) |
| `tests/test_operations.rs` | 15 | Every `Operation` variant: construct, validate, serde round-trip (HttpRequest GET/POST, EvmRead, EvmWrite, GetSecret, CodeNode, JsonParse, AbiEncode, AbiDecode, Branch, Filter, Merge, AiCall, Log, ErrorThrow) |
| `tests/test_value_expr.rs` | 11 | Every `ValueExpr` variant serde round-trip: Literal (String, Number, Integer, Boolean, Null, Json), Binding, ConfigRef, TriggerDataRef, Template with mixed parts, RawExpr |
| `tests/test_topologies.rs` | 8 | Complex graph shapes: linear chain, diamond pattern, nested branches, both-terminate branch, filter-then-work, multi-chain EVM, sequential HTTP, code node referencing multiple prior steps |
| `tests/test_validation.rs` | 19 | Exhaustive positive + negative tests for every error code (E002–E012): dup IDs across branches, cross-branch refs, parent-scope refs, merge placement, merge ID mismatch, reconverge-at non-merge, secrets in BasicAuth/AiCall/branches, EVM chain in trigger/steps, AI counting as HTTP, worst-branch budget, EVM read/write budget, partial return paths, ErrorThrow termination, diamond return |
| `tests/test_triggers.rs` | 3 | Every `TriggerDef` variant serde round-trip: Cron, Http, EvmLog |

### Running tests

```bash
cd compiler
cargo test                        # All tests
cargo test test_operations        # Only operation tests
cargo test test_validation        # Only validation tests
cargo test test_value_expr        # Only ValueExpr serde tests
cargo test test_topologies        # Only topology tests
cargo test test_triggers          # Only trigger tests
cargo test -- --list              # List all test names
```
