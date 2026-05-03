# Auto-generated Containerfile
# Project: converged-portal
# Role: ms

FROM docker.io/oven/bun:1.3-alpine AS builder
WORKDIR /build

COPY clarity/projects/converged-portal ./clarity/projects/converged-portal
COPY saas/public/front/front-landings ./saas/public/front/front-landings

RUN cd /build/clarity/projects/converged-portal && bun install --frozen-lockfile

RUN mkdir -p /build/out/app /build/out/plugins/chunks /build/out/plugins/workflows \
      /build/out/plugins/bin-libs /build/out/lib

RUN cd /build/clarity/projects && bun build \
    ./converged-portal/back/microservices/ai/ms-assistant/src/plugin.ts \
    ./converged-portal/back/microservices/analytics/ms-logs/src/plugin.ts \
    ./converged-portal/back/microservices/analytics/ms-telemetry/src/plugin.ts \
    ./converged-portal/back/microservices/analytics/ms-usage/src/plugin.ts \
    ./converged-portal/back/microservices/business/ms-billing/src/plugin.ts \
    ./converged-portal/back/microservices/business/ms-dag/src/plugin.ts \
    ./converged-portal/back/microservices/business/ms-equipment/src/plugin.ts \
    ./converged-portal/back/microservices/business/ms-requests/src/plugin.ts \
    ./converged-portal/back/microservices/business/ms-reviews/src/plugin.ts \
    ./converged-portal/back/microservices/business/ms-sheduller/src/plugin.ts \
    ./converged-portal/back/microservices/business/ms-webhooks/src/plugin.ts \
    ./converged-portal/back/microservices/content/ms-galery/src/plugin.ts \
    ./converged-portal/back/microservices/content/ms-markdown/src/plugin.ts \
    ./converged-portal/back/microservices/content/ms-struct/src/plugin.ts \
    ./converged-portal/back/microservices/content/ms-video/src/plugin.ts \
    ./converged-portal/back/microservices/data/ms-dumps/src/plugin.ts \
    ./converged-portal/back/microservices/data/ms-files/src/plugin.ts \
    ./converged-portal/back/microservices/data/ms-store/src/plugin.ts \
    ./converged-portal/back/microservices/providers/ms-push/src/plugin.ts \
    ./converged-portal/back/microservices/providers/ms-sms/src/plugin.ts \
    ./converged-portal/back/microservices/providers/ms-smtp/src/plugin.ts \
    ./converged-portal/back/microservices/sequrity/ms-access/src/plugin.ts \
    ./converged-portal/back/microservices/sequrity/ms-auth/src/plugin.ts \
    ./converged-portal/back/microservices/sequrity/ms-oauth/src/plugin.ts \
    ./converged-portal/back/microservices/social/ms-community/src/plugin.ts \
    ./converged-portal/back/microservices/social/ms-charts/src/plugin.ts \
    ./converged-portal/back/microservices/social/ms-calls/src/plugin.ts \
    ./converged-portal/back/microservices/social/ms-discord/src/plugin.ts \
    ./converged-portal/back/microservices/social/ms-facebook/src/plugin.ts \
    ./converged-portal/back/microservices/social/ms-instagram/src/plugin.ts \
    ./converged-portal/back/microservices/social/ms-notify/src/plugin.ts \
    ./converged-portal/back/microservices/social/ms-telegram/src/plugin.ts \
    ./converged-portal/back/microservices/social/ms-threads/src/plugin.ts \
    ./converged-portal/back/microservices/social/ms-tiktok/src/plugin.ts \
    ./converged-portal/back/microservices/social/ms-wechat/src/plugin.ts \
    ./converged-portal/back/microservices/social/ms-youtube/src/plugin.ts \
    --target bun --format esm --splitting --outdir /build/out/plugins/chunks --minify

RUN bun build /build/clarity/projects/converged-portal/back/workflows/index.ts \
    --target bun --format esm --outdir /build/out/plugins/workflows \
    --minify --no-splitting

RUN mkdir -p /build/out/plugins/bin-libs && \
    find /build/clarity/projects/converged-portal/back/native -type f -path '*/bin-libs/*-x86_64-musl.so' -not -path '*/bun-lmdbx/*' -not -path '*/bun-stanchion/*' -not -path '*/bun-vector/*' -exec cp {} /build/out/plugins/bin-libs/ \;

RUN cat > /build/out/app/runtime-map.toml <<'TOML'
[services]
"ai/assistant" = "/app/plugins/chunks/converged-portal/back/microservices/ai/ms-assistant/src/plugin.js"
"analytics/logs" = "/app/plugins/chunks/converged-portal/back/microservices/analytics/ms-logs/src/plugin.js"
"analytics/telemetry" = "/app/plugins/chunks/converged-portal/back/microservices/analytics/ms-telemetry/src/plugin.js"
"analytics/usage" = "/app/plugins/chunks/converged-portal/back/microservices/analytics/ms-usage/src/plugin.js"
"business/billing" = "/app/plugins/chunks/converged-portal/back/microservices/business/ms-billing/src/plugin.js"
"business/dag" = "/app/plugins/chunks/converged-portal/back/microservices/business/ms-dag/src/plugin.js"
"business/equipment" = "/app/plugins/chunks/converged-portal/back/microservices/business/ms-equipment/src/plugin.js"
"business/requests" = "/app/plugins/chunks/converged-portal/back/microservices/business/ms-requests/src/plugin.js"
"business/reviews" = "/app/plugins/chunks/converged-portal/back/microservices/business/ms-reviews/src/plugin.js"
"business/sheduller" = "/app/plugins/chunks/converged-portal/back/microservices/business/ms-sheduller/src/plugin.js"
"business/webhooks" = "/app/plugins/chunks/converged-portal/back/microservices/business/ms-webhooks/src/plugin.js"
"content/galery" = "/app/plugins/chunks/converged-portal/back/microservices/content/ms-galery/src/plugin.js"
"content/markdown" = "/app/plugins/chunks/converged-portal/back/microservices/content/ms-markdown/src/plugin.js"
"content/struct" = "/app/plugins/chunks/converged-portal/back/microservices/content/ms-struct/src/plugin.js"
"content/video" = "/app/plugins/chunks/converged-portal/back/microservices/content/ms-video/src/plugin.js"
"data/dumps" = "/app/plugins/chunks/converged-portal/back/microservices/data/ms-dumps/src/plugin.js"
"data/files" = "/app/plugins/chunks/converged-portal/back/microservices/data/ms-files/src/plugin.js"
"data/store" = "/app/plugins/chunks/converged-portal/back/microservices/data/ms-store/src/plugin.js"
"providers/push" = "/app/plugins/chunks/converged-portal/back/microservices/providers/ms-push/src/plugin.js"
"providers/sms" = "/app/plugins/chunks/converged-portal/back/microservices/providers/ms-sms/src/plugin.js"
"providers/smtp" = "/app/plugins/chunks/converged-portal/back/microservices/providers/ms-smtp/src/plugin.js"
"sequrity/access" = "/app/plugins/chunks/converged-portal/back/microservices/sequrity/ms-access/src/plugin.js"
"sequrity/auth" = "/app/plugins/chunks/converged-portal/back/microservices/sequrity/ms-auth/src/plugin.js"
"sequrity/oauth" = "/app/plugins/chunks/converged-portal/back/microservices/sequrity/ms-oauth/src/plugin.js"
"social/community" = "/app/plugins/chunks/converged-portal/back/microservices/social/ms-community/src/plugin.js"
"social/charts" = "/app/plugins/chunks/converged-portal/back/microservices/social/ms-charts/src/plugin.js"
"social/calls" = "/app/plugins/chunks/converged-portal/back/microservices/social/ms-calls/src/plugin.js"
"social/discord" = "/app/plugins/chunks/converged-portal/back/microservices/social/ms-discord/src/plugin.js"
"social/facebook" = "/app/plugins/chunks/converged-portal/back/microservices/social/ms-facebook/src/plugin.js"
"social/instagram" = "/app/plugins/chunks/converged-portal/back/microservices/social/ms-instagram/src/plugin.js"
"social/notify" = "/app/plugins/chunks/converged-portal/back/microservices/social/ms-notify/src/plugin.js"
"social/telegram" = "/app/plugins/chunks/converged-portal/back/microservices/social/ms-telegram/src/plugin.js"
"social/threads" = "/app/plugins/chunks/converged-portal/back/microservices/social/ms-threads/src/plugin.js"
"social/tiktok" = "/app/plugins/chunks/converged-portal/back/microservices/social/ms-tiktok/src/plugin.js"
"social/wechat" = "/app/plugins/chunks/converged-portal/back/microservices/social/ms-wechat/src/plugin.js"
"social/youtube" = "/app/plugins/chunks/converged-portal/back/microservices/social/ms-youtube/src/plugin.js"

[workflows]
plugin = "/app/plugins/workflows/index.js"
TOML

RUN bun build /build/clarity/projects/converged-portal/tools/container-runtime/server.entry.ts \
    --target bun --format esm --outfile /build/out/app/server.js --minify

RUN cat > /build/out/app/package.json <<'EOF'
{
  "name": "runtime-ms",
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

FROM docker.io/oven/bun:1.3-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache vips

COPY --from=builder /build/out/app/package.json ./package.json
RUN bun install --production

COPY --from=builder /build/out/app/server.js ./server.js
COPY --from=builder /build/out/app/bunfig.toml ./bunfig.toml
COPY --from=builder /build/out/app/runtime-map.toml ./runtime-map.toml
COPY --from=builder /build/out/plugins/chunks ./plugins/chunks
COPY --from=builder /build/out/plugins/workflows ./plugins/workflows
COPY --from=builder /build/out/plugins/bin-libs ./plugins/bin-libs
COPY --from=builder /build/out/lib ./lib

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/data
ENV PROJECT_DIR=/app
ENV RUNTIME_MAP_PATH=/app/runtime-map.toml
ENV CONFIG_PATH=/app/config.json
ENV BIN_LIBS_PATH=/app/plugins/bin-libs
ENV LD_LIBRARY_PATH=/app/lib:/usr/lib
EXPOSE 3001
CMD ["bun", "./server.js"]