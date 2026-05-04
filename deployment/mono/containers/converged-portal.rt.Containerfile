# Auto-generated Containerfile
# Project: converged-portal
# Role: rt

FROM docker.io/oven/bun:1.3-alpine AS builder
WORKDIR /build

ENV NODE_ENV=production

COPY clarity/projects/converged-portal ./clarity/projects/converged-portal
COPY saas/public/front/front-landings ./saas/public/front/front-landings

RUN cd /build/clarity/projects/converged-portal && bun install --frozen-lockfile

RUN mkdir -p /build/out/app /build/out/plugins/chunks \
      /build/out/plugins/bin-libs /build/out/lib /build/out/back/runtime

RUN bun build /build/clarity/projects/converged-portal/back/runtimes/automation/rt-dag/src/plugin.ts \
    --target bun --format esm --outdir /build/out/plugins/runtimes/automation/rt-dag \
    --minify --no-splitting
RUN bun build /build/clarity/projects/converged-portal/back/runtimes/automation/rt-cron/src/plugin.ts \
    --target bun --format esm --outdir /build/out/plugins/runtimes/automation/rt-cron \
    --minify --no-splitting
RUN bun build /build/clarity/projects/converged-portal/back/runtimes/automation/rt-gates/src/plugin.ts \
    --target bun --format esm --outdir /build/out/plugins/runtimes/automation/rt-gates \
    --minify --no-splitting
RUN bun build /build/clarity/projects/converged-portal/back/runtimes/ai/rt-agents/src/plugin.ts \
    --target bun --format esm --outdir /build/out/plugins/runtimes/ai/rt-agents \
    --minify --no-splitting
RUN bun build /build/clarity/projects/converged-portal/back/runtimes/ai/rt-chat/src/plugin.ts \
    --target bun --format esm --outdir /build/out/plugins/runtimes/ai/rt-chat \
    --minify --no-splitting

RUN mkdir -p /build/out/back/runtime && \
    cp -R /build/clarity/projects/converged-portal/back/runtime/workflows/. /build/out/back/runtime/converged-workflows/

RUN bun build /build/clarity/projects/converged-portal/back/runtime/workflows/providers/index.ts --target bun --format esm --outfile /build/out/back/runtime/converged-workflows/providers/index.js --minify

RUN mkdir -p /build/out/plugins/bin-libs && \
    find /build/clarity/projects/converged-portal/back/native -type f -path '*/bin-libs/*-x86_64-*.so' -exec cp -uf {} /build/out/plugins/bin-libs/ \; && \
    find /build/clarity/projects/converged-portal/native/behemoth/bun-transport/bin-libs -type f -name 'libtransport-*-*.so' -exec cp -uf {} /build/out/plugins/bin-libs/ \;

RUN cat > /build/out/app/runtime-map.toml <<'TOML'
[services]
"automation/dag" = "/app/plugins/runtimes/automation/rt-dag/plugin.js"
"automation/cron" = "/app/plugins/runtimes/automation/rt-cron/plugin.js"
"automation/gates" = "/app/plugins/runtimes/automation/rt-gates/plugin.js"
"ai/agents" = "/app/plugins/runtimes/ai/rt-agents/plugin.js"
"ai/chat" = "/app/plugins/runtimes/ai/rt-chat/plugin.js"

[cache]
url = "redis://127.0.0.1:6379/0"
keyPrefix = "converged-portal"
ssrTtlSeconds = 120
TOML

RUN bun build /build/clarity/projects/converged-portal/tools/container-runtime/server.entry.ts \
    --target bun --format esm --outfile /build/out/app/server.js --minify

RUN cat > /build/out/app/package.json <<'EOF'
{
  "name": "runtime-rt",
  "private": true,
  "type": "module",
  "dependencies": {
    "sharp": "latest"
  }
}
EOF

RUN cat > /build/out/app/bunfig.toml <<'EOF'
[run]
smol = true
EOF

RUN cat > /build/out/app/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "paths": {
      "@rt/converged/*": [
        "./back/runtime/converged-workflows/*"
      ]
    }
  }
}
EOF

FROM docker.io/oven/bun:1.3-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache vips

COPY --from=builder /build/out/app/package.json ./package.json
RUN bun install --production

COPY --from=builder /build/out/app/server.js ./server.js
COPY --from=builder /build/out/app/bunfig.toml ./bunfig.toml
COPY --from=builder /build/out/app/runtime-map.toml ./runtime-map.toml
COPY --from=builder /build/out/app/tsconfig.json ./tsconfig.json
COPY --from=builder /build/out/plugins/runtimes/automation/rt-dag ./plugins/runtimes/automation/rt-dag
COPY --from=builder /build/out/plugins/runtimes/automation/rt-cron ./plugins/runtimes/automation/rt-cron
COPY --from=builder /build/out/plugins/runtimes/automation/rt-gates ./plugins/runtimes/automation/rt-gates
COPY --from=builder /build/out/plugins/runtimes/ai/rt-agents ./plugins/runtimes/ai/rt-agents
COPY --from=builder /build/out/plugins/runtimes/ai/rt-chat ./plugins/runtimes/ai/rt-chat
COPY --from=builder /build/out/plugins/bin-libs ./plugins/bin-libs
COPY --from=builder /build/out/back ./back

RUN mkdir -p /app/data /app/plugins && chown -R 1000:1000 /app

ENV NODE_ENV=production
ENV PORT=3002
ENV DATA_DIR=/app/data
ENV PROJECT_DIR=/app
ENV RUNTIME_MAP_PATH=/app/runtime-map.toml
ENV CONFIG_PATH=/app/config.json
ENV BIN_LIBS_PATH=/app/plugins/bin-libs
ENV LIBC_VARIANT=musl

RUN adduser -D -u 1000 default || true
USER 1000
EXPOSE 3002
CMD ["bun", "./server.js"]