# Overview

6Flow Studio is Tokenization Workflow Platform.
We provide a programmable, low-code orchestration layer for the Chainlink Runtime Environment (CRE). We empower corporate developers to visually design complex workflows—combining off-chain data (KYC, Banks) with on-chain actions (Minting, Burning)—without managing underlying infrastructure.

# Vision

IDE for Smart Contract Engineers in Financial Enterprise
It's like an n8n for CRE

# Product Strategy

Target Group: Banks that are not top-tier and still want to do tokenization
Pain Point: I want to do tokenization stuff (stablecoin, stock, bond, etc.) But I don’t want (and won’t) to handle all technology issues myself. The ideas to hiring internal smart contract engineer, get smart contract audit blah blah are too crazy for me.

The only solution for now is on cloud (but we will provide on-premise later)

# Philosophy in Coding

- Code-First Extensibility: Modeled after n8n, we reject the "black box" node approach. While we offer pre-built nodes (e.g., "Mint ERC-20"), our killer feature is the Code Node. Users can inject raw JavaScript/TypeScript into any step of the workflow, allowing for infinite flexibility in data transformation and logic.
- Workflow is non-linear (conditional, loop)
- The "Compiler" Pattern (Not Interpreter): We do not "run" workflows on our servers. We compile in browser, check errors, send it to server to run workflow simulate. The end goal for now is to download .zip project and let user deploy manually. 

# Tech Stack

## Frontend

- NextJS
- Chart: React Flow (inspired from n8n)

## Backend

- NestJS for services
- Rust for compiler (inspired from SWC Speedy Web Compiler)

## Database

- PostgreSQL

## Deployment

- Frontend: Vercel
- Backend: Google Cloud?

## Runtime

- Chainlink Runtime Environment

## Testing

- Jest

# Project Structure

```bash
.
├── backend/    # NestJS backend services
├── compiler/   # Rust-based compiler for CRE
├── frontend/   # NextJS frontend application
├── shared/     # Shared helper functions and data models across codebase
```

# Diagram

```mermaid
graph LR
    A[Frontend<br/>(ReactFlow)]
    B[Node-Edge object<br/>from backend]
    C[Transpiler<br/>(Rust)]
    D[CRE code<br/>(TypeScript)]
    E[cre workflow<br/>simulate]
    F[Download CRE.zip]

    A -->|REST API| B
    B --> C
    C --> D
    D --> E
    E --> F
    E -- "Fail, Error message, Response" --> A

    %% Styling to match the original chart's appearance
    style A fill:#ffcccc,stroke:#ff4d00,stroke-width:2px
    style B fill:#ffcccc,stroke:#ff4d00,stroke-width:2px
    style C fill:#ffcccc,stroke:#ff4d00,stroke-width:2px
    style D fill:#ffcccc,stroke:#ff4d00,stroke-width:2px
    style E fill:#ffcccc,stroke:#ff4d00,stroke-width:2px
    style F fill:#ffcccc,stroke:#ff4d00,stroke-width:2px
```

