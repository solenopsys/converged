# The microservice image.
#
# Two stages, and only the second one ships. The builder holds the checkout,
# the workspace `node_modules` and the whole native tree; the runtime gets a
# bundle — `server.js`, the dlopen'd libraries and the handful of dependencies
# that cannot be bundled. Nothing else crosses.
#
# There are no microservices in this image. A module is built by
# `core/tools/registry`, published by digest, and fetched from ptah at boot;
# `MICROSERVICES` says which ones and `MODULE_DIGESTS` says which bytes. So the
# image stops changing when a module does, and one image serves every solution
# without carrying a single module of any of them.
#
# Build context is the repository root — the directory holding `converged/`
# and any product extending it:
#
#   podman build -f converged/core/containers/ms.Containerfile \
#     --ignorefile converged/core/containers/containerignore \
#     --build-arg PROJECT=club -t localhost/club-ms:latest .

ARG BUN_IMAGE=docker.io/oven/bun:1.4-alpine
# Execute-only Bun fork: it runs a prebuilt entrypoint and carries no bundler,
# no package manager and no CLI dispatch. Source at core/native/wrappers/rt/cruller.
ARG RUNTIME_IMAGE=public.ecr.aws/i5x9u8b2/cruller

FROM ${BUN_IMAGE} AS builder
ARG PROJECT=converged
WORKDIR /build

COPY . /build

# Parent first: a product's workspace links back into converged, so its own
# install needs those packages already present.
RUN cd /build/converged && bun install
RUN if [ "${PROJECT}" != "converged" ]; then cd "/build/${PROJECT}" && bun install; fi

# NRPC clients are generated, not committed for every consumer. Both layers
# regenerate: a product adds contracts of its own but still uses the base ones.
RUN cd /build/converged && bun run gen
RUN if [ "${PROJECT}" != "converged" ]; then cd "/build/${PROJECT}" && bun run gen; fi

RUN bun /build/converged/core/containers/bundle.ts \
      --role=ms \
      --root=/build \
      --project-dir=/build/converged \
      --child-project-dir="/build/${PROJECT}" \
      --out=/build/out

# One directory for every dlopen'd native library.
#
# BIN_LIBS_PATH is a single variable, but the libraries ship next to their own
# packages — the transport under cruller-transport, the markdown parser under
# cruller-md4c. Whichever directory it pointed at, the other package's dlopen
# would fail.
#
# Only this arch's musl variants are copied: the packages carry every
# arch/libc combination and the rest is 50+ MB the image would never load.
# libzimq goes in under its bare soname because that is what libmessage links
# against, and libmessage is checked for the symbols the transport calls —
# a stale copy otherwise fails at the first message rather than at boot.
RUN SRC=/build/converged/core/native/libs && ARCH=$(uname -m) && \
    mkdir -p /build/out/plugins/bin-libs && \
    grep -aq msg_declare_target "$SRC/cruller-transport/bin-libs/libmessage-$ARCH-musl.so" && \
    grep -aq msg_declare_route  "$SRC/cruller-transport/bin-libs/libmessage-$ARCH-musl.so" && \
    cp "$SRC/cruller-transport/bin-libs/libmessage-$ARCH-musl.so"   /build/out/plugins/bin-libs/ && \
    cp "$SRC/cruller-transport/bin-libs/libtransport-$ARCH-musl.so" /build/out/plugins/bin-libs/ && \
    cp "$SRC/cruller-transport/bin-libs/libzimq-$ARCH-musl.so"      /build/out/plugins/bin-libs/libzimq.so && \
    cp "$SRC/cruller-md4c/bin-libs/libmd4c-$ARCH-musl.so"           /build/out/plugins/bin-libs/

# Dependencies that must stay outside the bundle. sharp loads prebuilt native
# binaries and lightningcss is dlopen'd the same way, so bundling either
# produces a module that cannot find its own artifacts at runtime.
RUN cat > /build/out/app/package.json <<'JSON'
{
  "name": "runtime-ms",
  "private": true,
  "type": "module",
  "dependencies": {
    "sharp": "latest"
  }
}
JSON
RUN cd /build/out/app && bun install --production

# Cruller runs the bundle directly; smol trades a little throughput for a
# markedly smaller resident set, which is what matters with many replicas.
RUN cat > /build/out/app/bunfig.toml <<'TOML'
[run]
smol = true
TOML

FROM ${RUNTIME_IMAGE} AS runtime
WORKDIR /app
USER root

# libstdc++ backs the native transport and storage wrappers; vips and libgomp
# are what sharp's prebuilt binaries link against.
RUN apk add --no-cache libstdc++ vips libgomp

COPY --from=builder /build/out/app/server.js    ./server.js
COPY --from=builder /build/out/app/package.json ./package.json
COPY --from=builder /build/out/app/bunfig.toml  ./bunfig.toml
COPY --from=builder /build/out/app/node_modules ./node_modules
COPY --from=builder /build/out/plugins/bin-libs ./plugins/bin-libs
COPY --from=builder /build/converged/core/containers/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh && mkdir -p /app/data /app/modules && chown -R 1000:1000 /app
USER 1000

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/data
# Where fetched modules land. The endpoint they come from (MODULE_PROXY) and
# the mapping that names them (MODULE_DIGESTS) are deployment facts and stay
# unset; without them the server resolves modules from source, which is what a
# dev run does and what this image has nothing to do.
ENV MODULE_CACHE_DIR=/app/modules
# Cache defaults the image can legitimately own; the endpoint itself
# (VALKEY_URL) and the scope are deployment facts and stay unset.
ENV VALKEY_KEY_PREFIX=cache
ENV VALKEY_TTL_SECONDS=120
# The native transport is dlopen'd by variant. This base is Alpine, so the
# default "gnu" would resolve to a library whose loader the image does not
# have — and the failure only surfaces at the first message, not at boot.
ENV BIN_LIBS_PATH=/app/plugins/bin-libs
ENV LIBC_VARIANT=musl

EXPOSE 3001

# Required from the platform: FUJIN_ZMQ_ENDPOINT, SERVICE_TOKEN, VALKEY_URL,
# STORAGE_TENANT_SERVICES (or STORAGE_SCOPE), MICROSERVICES, MODULE_PROXY,
# MODULE_DIGESTS.
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["bun", "/app/server.js"]
