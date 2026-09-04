# The UI image: SSR host, the SPA shell, surface bundles and static assets.
#
# Two stages, and only the second one ships. The builder holds the checkout and
# the workspace `node_modules`; the runtime gets the bundled landing host, the
# client delivery and the static assets it serves. Nothing else crosses.
#
# There are no surfaces in this image. Each is built once by
# `core/tools/registry` with its own CSS packed inside, published by digest, and
# served from ptah — the import map the browser receives is composed at runtime
# from `FRONTEND_MODULES`, so one image serves every solution and a module rolls
# forward without rebuilding it. The SSR host, by contrast, belongs to the
# product: it statically imports its own blocks, so `--build-arg PROJECT` selects
# whose landing is bundled and the delivery is compiled from the same blocks.
#
# Build context is the repository root:
#
#   podman build -f converged/core/containers/ui.Containerfile \
#     --ignorefile converged/core/containers/containerignore \
#     --build-arg PROJECT=club -t localhost/club-ui:latest .

ARG BUN_IMAGE=docker.io/oven/bun:1.4-alpine
# Execute-only Bun fork: it runs a prebuilt entrypoint and carries no bundler,
# no package manager and no CLI dispatch. Source at core/native/wrappers/rt/cruller.
ARG RUNTIME_IMAGE=public.ecr.aws/i5x9u8b2/cruller

FROM ${BUN_IMAGE} AS builder
ARG PROJECT=converged
WORKDIR /build

COPY . /build

RUN cd /build/converged && bun install
RUN if [ "${PROJECT}" != "converged" ]; then cd "/build/${PROJECT}" && bun install; fi

RUN cd /build/converged && bun run gen
RUN if [ "${PROJECT}" != "converged" ]; then cd "/build/${PROJECT}" && bun run gen; fi

# The store worker is a separate bundle the SPA build embeds by path, so it has
# to exist before that build runs.
RUN cd /build/converged/core/frontend/libraries/files/store-workers \
    && bun run src/tools/build.ts

# The client delivery: the shell, the vendor layer, the base style layer and
# the installable layer. `SURFACES=` — set and empty, which the build
# reads as "none" — because the modules are registry objects now: the image
# cannot know which of them a solution will ask for, and the ui server resolves
# `/sf/<name>.js` through ptah at request time.
RUN cd /build/converged/core/frontend/spa && \
    PROJECT_DIR=/build/converged \
    CHILD_PROJECT_DIR="/build/${PROJECT}" \
    SURFACES= \
    NODE_ENV=production bun run build

RUN bun /build/converged/core/containers/bundle.ts \
      --role=ui \
      --root=/build \
      --project-dir=/build/converged \
      --child-project-dir="/build/${PROJECT}" \
      --out=/build/out

# The landing host's own assets, from whichever project owns the host. Kept in
# step with bundle.ts, which resolves the same directory.
RUN LANDING="/build/${PROJECT}/core/frontend/landing" && \
    [ -d "$LANDING/src" ] || LANDING=/build/converged/core/frontend/landing && \
    mkdir -p /build/out/public && \
    cp -R "$LANDING/public/." /build/out/public/

# Only this arch's musl variants: the packages carry every arch/libc
# combination and the rest is 50+ MB the image would never load. libzimq goes
# in under its bare soname because that is what libmessage links against.
RUN SRC=/build/converged/core/native/libs && ARCH=$(uname -m) && \
    mkdir -p /build/out/plugins/bin-libs && \
    cp "$SRC/cruller-transport/bin-libs/libmessage-$ARCH-musl.so"   /build/out/plugins/bin-libs/ && \
    cp "$SRC/cruller-transport/bin-libs/libtransport-$ARCH-musl.so" /build/out/plugins/bin-libs/ && \
    cp "$SRC/cruller-transport/bin-libs/libzimq-$ARCH-musl.so"      /build/out/plugins/bin-libs/libzimq.so && \
    cp "$SRC/cruller-md4c/bin-libs/libmd4c-$ARCH-musl.so"           /build/out/plugins/bin-libs/

# Dependencies that must stay outside the bundle: both load prebuilt native
# binaries, which a bundled copy cannot find.
RUN cat > /build/out/app/package.json <<'JSON'
{
  "name": "runtime-ui",
  "private": true,
  "type": "module",
  "dependencies": {
    "sharp": "latest",
    "lightningcss": "^1.33.0"
  }
}
JSON
RUN cd /build/out/app && bun install --production

RUN cat > /build/out/app/bunfig.toml <<'TOML'
[run]
smol = true
TOML

FROM ${RUNTIME_IMAGE} AS runtime
WORKDIR /app
USER root

# libstdc++ backs the native transport; vips and libgomp are what sharp's
# prebuilt binaries link against.
RUN apk add --no-cache libstdc++ vips libgomp

COPY --from=builder /build/out/app/server.js    ./server.js
COPY --from=builder /build/out/app/package.json ./package.json
COPY --from=builder /build/out/app/bunfig.toml  ./bunfig.toml
COPY --from=builder /build/out/app/node_modules ./node_modules
COPY --from=builder /build/out/public           ./public
COPY --from=builder /build/out/plugins/bin-libs ./plugins/bin-libs
COPY --from=builder /build/converged/core/frontend/spa/dist ./dist/front
COPY --from=builder /build/converged/core/containers/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh && mkdir -p /app/data /app/modules && chown -R 1000:1000 /app
USER 1000

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
# Where fetched surfaces land before being handed to a browser. The
# registry endpoint and mapping are deployment facts and stay unset.
ENV MODULE_CACHE_DIR=/app/modules
# There is no source tree in this image; the bundled host still asks for the
# project root, and everything it reads through it now lives under /app.
ENV PROJECT_DIR=/app
# Where the client delivery built in the builder stage landed. A property of
# how this image was built, so it is set here rather than by the platform.
ENV FRONT_DELIVERY_DIR=/app/dist/front
ENV VALKEY_KEY_PREFIX=cache
ENV VALKEY_TTL_SECONDS=120
# The native transport is dlopen'd by variant. This base is Alpine, so the
# default "gnu" would resolve to a library whose loader the image does not
# have — and the failure only surfaces at the first message, not at boot.
ENV BIN_LIBS_PATH=/app/plugins/bin-libs
ENV LIBC_VARIANT=musl

EXPOSE 3000

# Required from the platform: FUJIN_ZMQ_ENDPOINT, VALKEY_URL, STORAGE_SCOPE,
# SERVICES_BASE, FRONT_LOCALE, FRONTEND_MODULES, MODULE_PROXY, MODULE_DIGESTS.
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["bun", "/app/server.js"]
