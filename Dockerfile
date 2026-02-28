# ---- Builder ----
FROM rust:slim AS builder

# Install Node.js 20 and build essentials
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    pkg-config \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install wasm-pack
RUN cargo install wasm-pack --locked

WORKDIR /app

# Copy root workspace manifest so Turbopack detects workspace root at /app
# (without this, Turbopack sets root to /app/frontend and refuses to follow
# the @6flow/shared symlink which resolves outside /app/frontend)
COPY package.json ./

# Copy workspace packages needed for npm install
COPY shared/ ./shared/
COPY frontend/package.json ./frontend/package.json

# Stub tools/tui workspace (listed in root workspaces but not needed for frontend build)
RUN mkdir -p tools/tui && \
    printf '{"name":"@6flow/tui","version":"0.0.1","private":true}' > tools/tui/package.json

# Install from root so workspace symlinks (node_modules/@6flow/shared -> ./shared)
# are created at /app level, inside the workspace root Turbopack detects
RUN npm install

# Copy remaining source
COPY compiler/ ./compiler/
COPY frontend/ ./frontend/

# Expose public env vars at build time (Next.js bakes NEXT_PUBLIC_* at build)
ARG NEXT_PUBLIC_CONVEX_URL
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_CONVEX_SITE_URL
ENV NEXT_PUBLIC_CONVEX_SITE_URL=$NEXT_PUBLIC_CONVEX_SITE_URL

# prebuild (wasm-pack → public/compiler/) then next build
RUN cd frontend && npm run build

# ---- Runner ----
FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# standalone output bundles everything needed
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public

EXPOSE 3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "frontend/server.js"]
