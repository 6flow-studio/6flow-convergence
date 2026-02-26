# 6Flow Compiler (Rust)

This crate is the compiler core for 6Flow workflows. It takes visual workflow JSON from the frontend and compiles it into a deployable CRE TypeScript project bundle.

## Pipeline Overview

```
Workflow JSON → Parse → Validate → Lower → IR Validate → Codegen → CRE TypeScript Bundle
```

| Phase | Entry point | Input → Output |
| --- | --- | --- |
| **Parse** | `parse::parse(json)` | JSON string → `Workflow` + `WorkflowGraph` |
| **Validate** | `validate::validate_graph(workflow, graph)` | Graph-level (V001–V010, with V007 reserved) + per-node (N001–N021) checks |
| **Lower** | `lower::lower(workflow, graph)` | `Workflow` → `WorkflowIR` (expand convenience nodes, resolve refs, detect branches) |
| **IR Validate** | `ir::validate_ir(ir)` | Structural/semantic IR invariants (E001–E012) |
| **Codegen** | `codegen::codegen(ir)` | `WorkflowIR` → 7-file CRE project bundle |

## Module Structure

```
src/
  lib.rs
  error.rs               # Unified CompilerError (code, phase, message, node_id)
  parse/
    mod.rs               # parse(), parse_and_build()
    types.rs             # Rust structs mirroring shared/model/node.ts (23 node types)
    graph.rs             # petgraph DiGraph wrapper, adjacency queries
  validate/
    mod.rs               # validate_graph(), validate_node()
    structural.rs        # Graph invariants V001–V010
    node_rules.rs        # Per-node config validation N001–N021
  lower/
    mod.rs               # lower() orchestrator
    topo.rs              # Topological sort
    trigger.rs           # Trigger node → TriggerDef + TriggerParam
    extract.rs           # config_schema, secrets, evm_chains extraction
    expand.rs            # Convenience node expansion (mintToken, checkKyc, etc.)
    reference.rs         # {{nodeId.field}} → ValueExpr parser
    builder.rs           # Step sequence assembly, branch/merge detection
  ir/
    mod.rs
    types.rs             # WorkflowIR, Step, Operation, ValueExpr, etc.
    validate.rs          # IR invariant checks E001–E012
  codegen/
    mod.rs               # codegen() → CodegenOutput
    writer.rs            # Indent-aware string builder
    value_expr.rs        # ValueExpr → TypeScript
    imports.rs           # IR scan for needed imports
    config_schema.rs     # Zod config schema emitter
    fetch_fns.rs         # Top-level fetch function emitter
    handler.rs           # Handler function emitter
    operations.rs        # Per-Operation TypeScript emitter
    trigger.rs           # initWorkflow + main() emitter
    files.rs             # config.json, secrets.yaml, workflow.yaml, etc.
  wasm.rs                # WASM entry points for browser use
```

## Parse

Deserializes frontend workflow JSON into Rust types. `WorkflowNode` is a `#[serde(tag = "type")]` enum with 23 variants, each wrapping `NodeBase<XxxConfig>`. `WorkflowGraph` wraps `petgraph::DiGraph` and provides adjacency lookups used by validation and lowering.

## Graph Validation (pre-IR)

Two layers of checks before lowering:

### Structural rules (V001–V010, V007 reserved)

| Code | Rule |
| --- | --- |
| V001 | Exactly 1 trigger node |
| V002 | All edges reference existing nodes |
| V003 | No duplicate edges |
| V004 | DAG (no cycles) |
| V005 | All nodes reachable from trigger |
| V006 | Trigger has no incoming edges |
| V007 | Reserved (termination is now guaranteed by lowering via auto-added fallback return when needed) |
| V008 | `if` node has exactly 2 outgoing edges with `true`/`false` handles |
| V009 | `merge` node has ≥2 incoming edges |
| V010 | No self-loops |

### Per-node config rules (N001–N021)

Required fields present and non-empty, value range checks (gasLimit ≤ 5M), secret references exist in `globalConfig.secrets`, template references syntactically valid.

## Lowering (Workflow → WorkflowIR)

The most complex phase. Algorithm:

1. **Topological sort** — petgraph `toposort()`, trigger always first
2. **Trigger mapping** — trigger config → `TriggerDef` + `TriggerParam`
3. **Global extraction** — collect `config_schema`, `required_secrets`, `evm_chains`
4. **Convenience expansion** — sugar nodes expand to primitives using `{nodeId}___sub` IDs:
   - `mintToken` → `{id}___encode` (AbiEncode) + `{id}___write` (EvmWrite)
   - `burnToken` → `{id}___encode` + `{id}___write`
   - `transferToken` → `{id}___encode` + `{id}___write`
   - `checkKyc` → `{id}___secret` (GetSecret) + `{id}___http` (HttpRequest) + `{id}___parse` (JsonParse)
   - `checkBalance` → single EvmRead (no expansion)
5. **Reference resolution** — `{{nodeId.field}}` → `ValueExpr` (Binding, ConfigRef, TriggerDataRef, Template)
6. **Step building** — walk topo order, build `Block`/`Step` structures, detect `if` → branch/merge diamond patterns via reachability analysis
7. **Assembly** — combine into `WorkflowIR`

## Intermediate Representation (IR)

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
- `Step` has: `id`, `source_node_ids`, `label`, `operation: Operation`, `output: Option<OutputBinding>`

### Core data reference model

`ValueExpr` is the unified expression system used across operations:

- `Literal` — string, number, integer, boolean, null, json
- `Binding` — reference to prior step output
- `ConfigRef` — `runtime.config.fieldName`
- `TriggerDataRef` — `triggerData.fieldName`
- `Template` — mixed literal + expression parts
- `RawExpr` — escape hatch for raw TypeScript

### Operation families

- CRE capabilities: `HttpRequest`, `EvmRead`, `EvmWrite`, `GetSecret`
- Transforms: `CodeNode`, `JsonParse`, `AbiEncode`, `AbiDecode`
- Control flow: `Branch`, `Filter`, `Merge`
- AI: `AiCall`
- Output/termination: `Log`, `ErrorThrow`, `Return`

## IR Validation

Entrypoint: `validate_ir(&WorkflowIR) -> Vec<ValidationError>`.

### Capability budget limits

- HTTP calls: max `5`
- EVM reads: max `10`
- EVM writes: max `5`

Branches are budget-counted by worst-case branch path (`max(true_branch, false_branch)`).

### IR validation error codes (E001–E012)

| Code | Meaning |
| --- | --- |
| E001 | Handler body is empty |
| E002 | Duplicate step ID |
| E003 | Invalid binding reference (not in scope / not forward-defined) |
| E004 | `Branch.reconverge_at` invalid (merge missing or not immediately next) |
| E005 | `Merge.branch_step_id` doesn't match the branch step |
| E006 | Step at `reconverge_at` position is not a Merge operation |
| E007 | Secret referenced but not declared in `required_secrets` |
| E008 | `evm_client_binding` not declared in `evm_chains` |
| E009 | HTTP call budget exceeded |
| E010 | EVM read budget exceeded |
| E011 | EVM write budget exceeded |
| E012 | Not all execution paths terminate with Return or ErrorThrow |

## Codegen

Entrypoint: `codegen(&WorkflowIR) -> CodegenOutput`.

Produces a 7-file CRE TypeScript project bundle: `main.ts`, `config.json`, `secrets.yaml`, `workflow.yaml`, `project.yaml`, `package.json`, `tsconfig.json`. The `main.ts` follows CRE's canonical structure: imports, config schema, top-level fetch functions, handler, `initWorkflow`, and `main()`.

## WASM Entry Points

Three `#[wasm_bindgen]` functions in `src/wasm.rs` for browser use:

| Function | Pipeline | Returns |
| --- | --- | --- |
| `validate_workflow(json)` | Parse → Graph Validate | `Vec<ErrorDto>` |
| `validate_node(node_json, config_json)` | Single node check | `Vec<ErrorDto>` |
| `compile_workflow(json)` | Full pipeline → Codegen | `CompileResult` (files or errors) |

All errors carry `node_id` for React Flow highlighting.

## Tests

129 tests covering parse, validation, lowering, IR, codegen, and end-to-end pipeline.

### Test structure

| File | Tests | What it covers |
| --- | --- | --- |
| `src/ir/validate.rs` (inline) | 8 | Minimal valid IR, empty handler, dup IDs, forward/backward bindings, missing secret, missing return, budget exceeded |
| `src/lower/reference.rs` (inline) | 6 | `{{nodeId.field}}` → ValueExpr parsing: literal, pure ref, config ref, trigger ref, template, id_map resolution |
| `tests/helpers/mod.rs` | — | Shared test builders (`base_ir`, `ir_with_steps`, `make_step`, operation constructors) |
| `tests/parse_basic.rs` | 5 | Parse round-trips, graph construction, node type checks |
| `tests/validate_graph.rs` | 6 | Graph-level validation rules (V001/V004/V005/V008/V010) |
| `tests/lower_basic.rs` | 3 | Linear lowering, convenience expansion (mintToken), example workflow lowering |
| `tests/ir_triggers.rs` | 3 | Every `TriggerDef` variant serde round-trip |
| `tests/ir_value_expr.rs` | 11 | Every `ValueExpr` variant serde round-trip |
| `tests/ir_operations.rs` | 15 | Every `Operation` variant: construct, validate, serde round-trip |
| `tests/ir_topologies.rs` | 8 | Complex graph shapes: linear, diamond, nested branches, multi-chain EVM |
| `tests/ir_validate.rs` | 19 | Exhaustive positive + negative tests for every IR error code (E002–E012) |
| `tests/codegen_basic.rs` | 6 | Codegen output: file count, snapshot tests for main.ts, config.json, secrets.yaml, package.json |
| `tests/e2e_pipeline.rs` | 1 | Full Parse → Validate → Lower → IR Validate → Codegen pipeline |
| `tests/e2e_kyc_minting.rs` | 5 | Canonical KYC-gated minting IR: validation, JSON round-trip, snapshot (`insta`), undeclared secret/chain |

### Test fixtures

JSON fixtures live in `tests/fixtures/` — example workflow, linear workflow, mint convenience, and broken graphs for each validation rule.

### Running tests

```bash
cd compiler
cargo test                       # All tests
cargo test --test parse_basic    # Parse / graph building
cargo test --test validate_graph # Graph-level V-code rules
cargo test --test lower_basic    # Lowering / convenience expansion
cargo test --test ir_triggers    # Trigger serde round-trips
cargo test --test ir_value_expr  # ValueExpr serde round-trips
cargo test --test ir_operations  # Operation serde round-trips
cargo test --test ir_topologies  # Workflow shape tests
cargo test --test ir_validate    # IR validation E-codes
cargo test --test codegen_basic  # Codegen snapshots
cargo test --test e2e_pipeline   # Full pipeline test
cargo test --test e2e_kyc_minting # Canonical KYC example
cargo test -- --list             # List all test names
cargo build --target wasm32-unknown-unknown  # Verify WASM build
```
