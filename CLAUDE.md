# AGENTS

This file guides agents and contributors working in this repo.

# Project Overview

6Flow Studio is a tokenization workflow platform and IDE for smart contract engineers in financial enterprise. It is like n8n for the Chainlink Runtime Environment (CRE): users design non-linear workflows visually, which are compiled into deployable CRE code.

# Project Structure

```bash
.
├── compiler/   # Rust-based compiler for CRE
├── frontend/   # NextJS frontend application
├── shared/     # Shared helper functions and data models across TypeScript codebase
├── cre-test/   # CRE test environment (for testing compiler output)
├── tools/      # TUI tooling for local secrets/simulation workflows
```

# Non-Negotiables

- UX and node-edge graph interactions should be inspired by n8n (but using React Flow).
- CRE is the runtime stack target; workflows are compiled, not interpreted on our servers.

# Architecture Notes

- Frontend: Next.js + React Flow for the node-edge editor and UX.
- Compiler: Rust transpiler that converts the graph into CRE (TypeScript) workflows.
- TUI tooling: `tools/tui` (Go + Bubble Tea) consumes `frontend/src/app/api/tui/*` to sync compiled bundles and run local secrets/simulation workflows.
- Runtime: Chainlink Runtime Environment (CRE).
- We let users to set their secret values in TUI. On frontend it just set the key of secrets.yaml.

# Contribution Expectations

- Keep changes scoped to one area (`frontend`, `compiler`) unless cross-cutting is required.
- Treat `tools/tui` + `frontend/src/app/api/tui/*` as one integration contract: if bundle/secrets/simulate behavior changes on one side, update the other side in the same PR.
- Preserve the "compiler pattern": visual graphs are transpiled into native, deployable CRE executables.
- Favor code-first extensibility: support a "Code Node" where users inject JS/TS logic.
- Maintain support for non-linear workflows (conditionals, loops).

# Testing

- Prefer fast, deterministic tests.
- Add tests alongside changes in the relevant area (`frontend`, `compiler`). If it's typescript, will use Jest

## How to run test compiler end-to-end

Starting at the root of project
```bash
bun shared/sample/generate_fixtures.ts
cd compiler && cargo test
cd ../cre-test && bun load-output.mjs && cre workflow simulate cre-testing-workflow --target staging-settings
```

# Compiler
- Compiler direction: use a 4-phase pipeline (Parse -> Validate -> IR -> Codegen) where visual workflow JSON is converted into a semantic IR before generating CRE output.
- Treat convenience nodes (e.g., mintToken, checkKyc) as syntax sugar expanded in IR into primitive CRE capabilities, so codegen only emits canonical CRE patterns (initWorkflow, handlers, capabilities, consensus).
- Expose three WASM APIs for frontend use: validate_workflow (graph-level checks), validate_node (live node checks), and compile_workflow (full build), with all errors carrying node_id for React Flow highlighting.
- Compiler output must be a complete deployable CRE project bundle (main.ts, config.json, workflow.yaml, project.yaml, secrets.yaml, package.json), not just a single source file.


# External Knowledges

- use Agents Skill 'cre-typescript' for CRE context
- use MCP for n8n documentation
