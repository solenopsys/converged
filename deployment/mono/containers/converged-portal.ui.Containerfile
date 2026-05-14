# Auto-generated Containerfile
# Project: converged-portal
# Role: ui

FROM docker.io/oven/bun:1.3-alpine AS builder
WORKDIR /build

ENV NODE_ENV=production

COPY clarity/projects/converged-portal ./clarity/projects/converged-portal
COPY saas/public/front/front-landings ./saas/public/front/front-landings

RUN cd /build/clarity/projects/converged-portal && bun install --frozen-lockfile

RUN cd /build/clarity/projects/converged-portal/front/front-core && NODE_ENV=production bun run bld
RUN cd /build/clarity/projects/converged-portal/front/landing && bun run build:client
RUN cd /build/clarity/projects/converged-portal/front/landing && MICROFRONTENDS=$'mf-auth,mf-agents,mf-assistants,mf-community,mf-charts,mf-calls,mf-classifier,mf-dag,mf-dasboards,mf-dumps,mf-docs,mf-galery,mf-landing,mf-logs,mf-markdown,mf-static,mf-struct,mf-orders,mf-requests,mf-sheduller,mf-telemetry,mf-threads,mf-usage,mf-webhooks' bun run build:mf
RUN cd /build/clarity/projects/converged-portal/front/landing && bun -e "const { buildStyles } = await import('./src/ssr/styles.ts'); const css = await buildStyles(); await Bun.write('./dist/styles.css', css);"
RUN cd /build/clarity/projects/converged-portal/front/landing && bun -e "import { existsSync, mkdirSync, writeFileSync } from 'node:fs'; import { resolve } from 'node:path'; const publicDir = resolve(process.cwd(), 'public'); mkdirSync(publicDir, { recursive: true }); const manifestPath = resolve(publicDir, 'manifest.json'); if (!existsSync(manifestPath)) { const manifest = { name: '4IR App', short_name: '4IR', description: '4IR application', start_url: '/', scope: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#000000', icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] }; writeFileSync(manifestPath, JSON.stringify(manifest, null, 2)); } const swPath = resolve(publicDir, 'sw.js'); if (!existsSync(swPath)) { writeFileSync(swPath, \"self.addEventListener('install', () => self.skipWaiting());\\nself.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));\\n\"); }"
RUN cd /build/clarity/projects/converged-portal/front/libraries/store-workers && bun run src/tools/build.ts

RUN mkdir -p /build/out/app /build/out/plugins/spa /build/out/plugins/landing \
      /build/out/dist/front /build/out/dist/landing /build/out/dist/mf /build/out/front

RUN bun build /build/clarity/projects/converged-portal/front/landing/src/plugin.tsx \
    --target bun --format esm --outdir /build/out/plugins/landing \
    --minify --external lightningcss --no-splitting

RUN bun build /build/clarity/projects/converged-portal/front/spa/src/plugin.ts \
    --target bun --format esm --outdir /build/out/plugins/spa \
    --minify --no-splitting

RUN cp -R /build/clarity/projects/converged-portal/front/front-core/dist/. /build/out/dist/front/ && \
    cp -R /build/clarity/projects/converged-portal/front/landing/dist/. /build/out/dist/landing/ && \
    cp -R /build/clarity/projects/converged-portal/dist/mf/. /build/out/dist/mf/ && \
    mkdir -p /build/out/front/front-core/locales && \
    cp -R /build/clarity/projects/converged-portal/front/front-core/locales/. /build/out/front/front-core/locales/ && \
    mkdir -p /build/out/front/landing/public && \
    cp -R /build/clarity/projects/converged-portal/front/landing/public/. /build/out/front/landing/public/ && \
    mkdir -p /build/out/front/libraries/store-workers/dist && \
    cp -R /build/clarity/projects/converged-portal/front/libraries/store-workers/dist/. /build/out/front/libraries/store-workers/dist/ && \
    mkdir -p /build/out/front/microfrontends && \
    mkdir -p /build/out/front/microfrontends/mf-auth/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/sequrity/mf-auth/locales/. /build/out/front/microfrontends/mf-auth/locales/ && \
    mkdir -p /build/out/front/microfrontends/mf-agents/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/ai/mf-agents/locales/. /build/out/front/microfrontends/mf-agents/locales/ && \
    mkdir -p /build/out/front/microfrontends/mf-assistants/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/ai/mf-assistants/locales/. /build/out/front/microfrontends/mf-assistants/locales/ && \
    mkdir -p /build/out/front/microfrontends/mf-calls/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/communications/mf-calls/locales/. /build/out/front/microfrontends/mf-calls/locales/ && \
    mkdir -p /build/out/front/microfrontends/mf-dag/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/automation/mf-dag/locales/. /build/out/front/microfrontends/mf-dag/locales/ && \
    mkdir -p /build/out/front/microfrontends/mf-dasboards/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/analytics/mf-dasboards/locales/. /build/out/front/microfrontends/mf-dasboards/locales/ && \
    mkdir -p /build/out/front/microfrontends/mf-dumps/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/data/mf-dumps/locales/. /build/out/front/microfrontends/mf-dumps/locales/ && \
    mkdir -p /build/out/front/microfrontends/mf-logs/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/analytics/mf-logs/locales/. /build/out/front/microfrontends/mf-logs/locales/ && \
    mkdir -p /build/out/front/microfrontends/mf-orders/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/business/mf-orders/locales/. /build/out/front/microfrontends/mf-orders/locales/ && \
    mkdir -p /build/out/front/microfrontends/mf-requests/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/business/mf-requests/locales/. /build/out/front/microfrontends/mf-requests/locales/ && \
    mkdir -p /build/out/front/microfrontends/mf-sheduller/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/automation/mf-sheduller/locales/. /build/out/front/microfrontends/mf-sheduller/locales/ && \
    mkdir -p /build/out/front/microfrontends/mf-telemetry/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/analytics/mf-telemetry/locales/. /build/out/front/microfrontends/mf-telemetry/locales/ && \
    mkdir -p /build/out/front/microfrontends/mf-threads/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/communications/mf-threads/locales/. /build/out/front/microfrontends/mf-threads/locales/ && \
    mkdir -p /build/out/front/microfrontends/mf-usage/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/analytics/mf-usage/locales/. /build/out/front/microfrontends/mf-usage/locales/ && \
    mkdir -p /build/out/front/microfrontends/mf-webhooks/locales && \
    cp -R /build/clarity/projects/converged-portal/front/microfrontends/automation/mf-webhooks/locales/. /build/out/front/microfrontends/mf-webhooks/locales/

RUN cat > /build/out/app/runtime-map.toml <<'TOML'
[services]

[spa]
plugin = "/app/plugins/spa/plugin.js"

[landing]
plugin = "/app/plugins/landing/plugin.js"

[cache]
url = "redis://127.0.0.1:6379/0"
keyPrefix = "converged-portal"
ssrTtlSeconds = 120
TOML

RUN bun build /build/clarity/projects/converged-portal/tools/container-runtime/server.entry.ts \
    --target bun --format esm --outfile /build/out/app/server.js --minify

RUN cat > /build/out/app/package.json <<'EOF'
{
  "name": "runtime-ui",
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
COPY --from=builder /build/out/plugins/spa ./plugins/spa
COPY --from=builder /build/out/plugins/landing ./plugins/landing
COPY --from=builder /build/out/dist ./dist
COPY --from=builder /build/out/front ./front

RUN mkdir -p /app/data /app/plugins && chown -R 1000:1000 /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV PROJECT_DIR=/app
ENV RUNTIME_MAP_PATH=/app/runtime-map.toml
ENV CONFIG_PATH=/app/config.json

RUN adduser -D -u 1000 default || true
USER 1000
EXPOSE 3000
CMD ["bun", "./server.js"]
