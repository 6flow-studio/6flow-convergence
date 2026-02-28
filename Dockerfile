# ---- Builder ----
FROM rust:1.82-slim AS builder

# Install Node.js 20 and build essentials
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    pkg-config \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install wasm-pack
RUN cargo install wasm-pack

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json turbo.json ./
COPY shared/package.json ./shared/package.json
COPY frontend/package.json ./frontend/package.json
COPY tools/tui/package.json ./tools/tui/package.json

RUN npm install

# Copy source
COPY compiler/ ./compiler/
COPY shared/ ./shared/
COPY frontend/ ./frontend/

# prebuild (wasm-pack → public/compiler/) then next build
RUN cd frontend && npm run build

# ---- Runner ----
FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# standalone output bundles everything needed
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./.next/static
COPY --from=builder /app/frontend/public ./public

EXPOSE 3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
