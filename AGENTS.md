# AGENTS

This file guides agents and contributors working in this repo.

# Project Overview

6Flow Studio is a tokenization workflow platform and IDE for smart contract engineers in financial enterprise. It is like n8n for the Chainlink Runtime Environment (CRE): users design non-linear workflows visually, which are compiled into deployable CRE code.

# Project Structure

```bash
.
├── backend/    # NestJS backend services
├── compiler/   # Rust-based compiler for CRE
├── frontend/   # NextJS frontend application
├── shared/     # Shared helper functions and data models across TypeScript codebase
```

# Non-Negotiables

- UX and node-edge graph interactions should be inspired by n8n (but using React Flow).
- CRE is the runtime stack target; workflows are compiled, not interpreted on our servers.

# Architecture Notes

- Frontend: Next.js + React Flow for the node-edge editor and UX.
- Backend: NestJS services that provide the node-edge object and APIs.
- Compiler: Rust transpiler that converts the graph into CRE (TypeScript) workflows.
- Runtime: Chainlink Runtime Environment (CRE).

# Contribution Expectations

- Keep changes scoped to one area (`frontend`, `backend`, or `compiler`) unless cross-cutting is required.
- Preserve the "compiler pattern": visual graphs are transpiled into native, deployable CRE executables.
- Favor code-first extensibility: support a "Code Node" where users inject JS/TS logic.
- Maintain support for non-linear workflows (conditionals, loops).

# Testing

- Prefer fast, deterministic tests.
- Add tests alongside changes in the relevant area (`frontend`, `backend`, `compiler`). If it's typescript, will use Jest

# Compiler
- Compiler direction: use a 4-phase pipeline (Parse -> Validate -> IR -> Codegen) where visual workflow JSON is converted into a semantic IR before generating CRE output.
- Treat convenience nodes (e.g., mintToken, checkKyc) as syntax sugar expanded in IR into primitive CRE capabilities, so codegen only emits canonical CRE patterns (initWorkflow, handlers, capabilities, consensus).
- Expose three WASM APIs for frontend use: validate_workflow (graph-level checks), validate_node (live node checks), and compile_workflow (full build), with all errors carrying node_id for React Flow highlighting.
- Compiler output must be a complete deployable CRE project bundle (main.ts, config.json, workflow.yaml, project.yaml, secrets.yaml, package.json), not just a single source file.

# Important Notes
- If you change the data type of a node, make sure you check and update the data type in the frontend, backend, and compiler. (mostly in shared/model/node.ts and compiler/src/ir/types.rs). If it affects the test, update the test as well.


# External Knowledges

- use Agents Skill 'cre-typescript' for CRE context
- use MCP for n8n documentation