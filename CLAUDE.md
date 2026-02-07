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
├── shared/     # Shared helper functions and data models across codebase
```

# Non-Negotiables

- We use test-driven development (TDD). Add or update tests first, then implement to make them pass.
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

- Follow TDD: write tests first.
- Prefer fast, deterministic tests.
- Add tests alongside changes in the relevant area (`frontend`, `backend`, `compiler`). If it's typescript, will use Jest

# External Knowledges

- use Agents Skill 'cre-typescript' for CRE context
- use MCP for n8n documentation
