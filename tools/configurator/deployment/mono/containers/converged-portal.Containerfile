# Auto-generated Containerfile
# Project: converged-portal

FROM docker.io/oven/bun:1.3-alpine AS builder
WORKDIR /build

COPY converged-portal ./converged-portal

RUN cd /build/converged-portal && bun install --frozen-lockfile

RUN cd /build/converged-portal/front/front-core && NODE_ENV=production bun run bld
RUN cd /build/converged-portal/front/landing && bun run build:client
RUN cd /build/converged-portal/front/landing && MICROFRONTENDS=$'mf-auth,mf-aichats,mf-calls,mf-dag,mf-dasboards,mf-dumps,mf-logs,mf-markdown,mf-requests,mf-sheduller,mf-telemetry,mf-threads,mf-usage,mf-webhooks' bun run build:mf
RUN cd /build/converged-portal/front/landing && bun -e "const { buildStyles } = await import('./src/ssr/styles.ts'); const css = await buildStyles(); await Bun.write('./dist/styles.css', css);"
RUN cd /build/converged-portal/front/libraries/store-workers && bun run src/tools/build.ts

RUN mkdir -p /build/out/app /build/out/plugins/chunks /build/out/dist/front \
      /build/out/dist/landing /build/out/dist/mf /build/out/front /build/out/lib

RUN bun build \
    /build/converged-portal/back/microservices/ai/ms-aichat/src/plugin.ts \
    /build/converged-portal/back/microservices/analytics/ms-logs/src/plugin.ts \
    /build/converged-portal/back/microservices/analytics/ms-telemetry/src/plugin.ts \
    /build/converged-portal/back/microservices/analytics/ms-usage/src/plugin.ts \
    /build/converged-portal/back/microservices/business/ms-billing/src/plugin.ts \
    /build/converged-portal/back/microservices/business/ms-dag/src/plugin.ts \
    /build/converged-portal/back/microservices/business/ms-equipment/src/plugin.ts \
    /build/converged-portal/back/microservices/business/ms-requests/src/plugin.ts \
    /build/converged-portal/back/microservices/business/ms-reviews/src/plugin.ts \
    /build/converged-portal/back/microservices/business/ms-sheduller/src/plugin.ts \
    /build/converged-portal/back/microservices/business/ms-webhooks/src/plugin.ts \
    /build/converged-portal/back/microservices/content/ms-galery/src/plugin.ts \
    /build/converged-portal/back/microservices/content/ms-markdown/src/plugin.ts \
    /build/converged-portal/back/microservices/content/ms-struct/src/plugin.ts \
    /build/converged-portal/back/microservices/content/ms-video/src/plugin.ts \
    /build/converged-portal/back/microservices/data/ms-dumps/src/plugin.ts \
    /build/converged-portal/back/microservices/data/ms-files/src/plugin.ts \
    /build/converged-portal/back/microservices/data/ms-store/src/plugin.ts \
    /build/converged-portal/back/microservices/providers/ms-push/src/plugin.ts \
    /build/converged-portal/back/microservices/providers/ms-sms/src/plugin.ts \
    /build/converged-portal/back/microservices/providers/ms-smtp/src/plugin.ts \
    /build/converged-portal/back/microservices/sequrity/ms-access/src/plugin.ts \
    /build/converged-portal/back/microservices/sequrity/ms-auth/src/plugin.ts \
    /build/converged-portal/back/microservices/sequrity/ms-oauth/src/plugin.ts \
    /build/converged-portal/back/microservices/social/ms-calls/src/plugin.ts \
    /build/converged-portal/back/microservices/social/ms-discord/src/plugin.ts \
    /build/converged-portal/back/microservices/social/ms-facebook/src/plugin.ts \
    /build/converged-portal/back/microservices/social/ms-instagram/src/plugin.ts \
    /build/converged-portal/back/microservices/social/ms-notify/src/plugin.ts \
    /build/converged-portal/back/microservices/social/ms-telegram/src/plugin.ts \
    /build/converged-portal/back/microservices/social/ms-threads/src/plugin.ts \
    /build/converged-portal/back/microservices/social/ms-tiktok/src/plugin.ts \
    /build/converged-portal/back/microservices/social/ms-wechat/src/plugin.ts \
    /build/converged-portal/back/microservices/social/ms-youtube/src/plugin.ts \
    --target bun --format esm --splitting --outdir /build/out/plugins/chunks --minify

RUN bun build /build/converged-portal/front/landing/src/plugin.tsx \
    --target bun --format esm --outdir /build/out/plugins/landing \
    --minify --external lightningcss --no-splitting

RUN cat > /build/out/app/runtime-map.toml <<'TOML'
[services]
"ai/aichat" = "/app/plugins/chunks/converged-portal/back/microservices/ai/ms-aichat/src/plugin.js"
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

[landing]
plugin = "/app/plugins/landing/plugin.js"
TOML

RUN cp -R /build/converged-portal/front/front-core/dist/. /build/out/dist/front/ && \
    cp -R /build/converged-portal/front/landing/dist/. /build/out/dist/landing/ && \
    cp -R /build/converged-portal/dist/mf/. /build/out/dist/mf/ && \
    mkdir -p /build/out/front/front-core/locales && \
    cp -R /build/converged-portal/front/front-core/locales/. /build/out/front/front-core/locales/ && \
    mkdir -p /build/out/front/landing/public && \
    cp -R /build/converged-portal/front/landing/public/. /build/out/front/landing/public/ && \
    mkdir -p /build/out/front/libraries/store-workers/dist && \
    cp -R /build/converged-portal/front/libraries/store-workers/dist/. /build/out/front/libraries/store-workers/dist/

RUN mkdir -p /build/out/plugins/bin-libs && \
    find /build/converged-portal/back/native -type f -path '*/bin-libs/*-x86_64-musl.so' -exec cp {} /build/out/plugins/bin-libs/ \;

RUN bun build /build/converged-portal/tools/container-runtime/server.entry.ts \
    --target bun --format esm --outfile /build/out/app/server.js --minify

RUN cat > /build/out/app/package.json <<'EOF'
{
  "name": "runtime-app",
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
COPY --from=builder /build/out/plugins ./plugins
COPY --from=builder /build/out/dist ./dist
COPY --from=builder /build/out/front ./front
COPY --from=builder /build/out/lib ./lib

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV PROJECT_DIR=/app
ENV BIN_LIBS_PATH=/app/plugins/bin-libs
ENV RUNTIME_MAP_PATH=/app/runtime-map.toml
ENV LD_LIBRARY_PATH=/app/lib:/usr/lib
ENV CONFIG_PATH=/app/config.json
EXPOSE 3000
CMD ["bun", "./server.js"]