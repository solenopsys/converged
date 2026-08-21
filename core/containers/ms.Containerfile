# The microservice image.
#
# This file used to be generated. The generator existed to bake one exact
# service list into `runtime-map.toml` at build time, which meant a new
# solution needed a new image. Modules are selected at runtime now, so there is
# nothing left to generate: the image carries every module in the tree and ptah
# says which ones boot.
#
# Build context is the repository root — the directory holding `converged/`
# and any product extending it:
#
#   podman build -f converged/core/containers/ms.Containerfile \
#     --ignorefile converged/core/containers/containerignore \
#     --build-arg PROJECT=club -t localhost/club-ms:latest .

ARG BUN_IMAGE=docker.io/oven/bun:1.3-alpine

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

FROM ${BUN_IMAGE} AS runtime
ARG PROJECT=converged
WORKDIR /app

# libstdc++ is what the native transport and storage wrappers link against.
RUN apk add --no-cache libstdc++ ca-certificates

COPY --from=builder /build /app/src
COPY --from=builder /build/converged/core/containers/entrypoint.sh /app/entrypoint.sh

# Module lookup searches the product first and falls back to converged. When
# the product *is* converged the two paths coincide, which costs one repeated
# directory scan and avoids a conditional that could disagree with itself.
ENV PROJECT_DIR=/app/src/converged
ENV CHILD_PROJECT_DIR=/app/src/${PROJECT}

# One directory for every dlopen'd native library.
#
# BIN_LIBS_PATH is a single variable, but the libraries ship next to their own
# packages — the transport under cruller-transport, the markdown parser under
# cruller-md4c. Whichever directory it pointed at, the other package's dlopen
# would fail. The generator this file replaces merged them for the same reason.
#
# Only the musl variants are copied, and libzimq is copied under its bare
# soname because that is the name libmessage links against.
RUN SRC=/app/src/converged/core/native/libs && ARCH=$(uname -m) && \
    mkdir -p /app/bin-libs && \
    cp "$SRC/cruller-transport/bin-libs/libmessage-$ARCH-musl.so"   /app/bin-libs/ && \
    cp "$SRC/cruller-transport/bin-libs/libtransport-$ARCH-musl.so" /app/bin-libs/ && \
    cp "$SRC/cruller-transport/bin-libs/libzimq-$ARCH-musl.so"      /app/bin-libs/libzimq.so && \
    cp "$SRC/cruller-md4c/bin-libs/libmd4c-$ARCH-musl.so"           /app/bin-libs/

RUN chmod +x /app/entrypoint.sh \
    && mkdir -p /app/data \
    && adduser -D -u 1000 default 2>/dev/null || true
RUN chown -R 1000:1000 /app
USER 1000

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/data
# Cache defaults the image can legitimately own; the endpoint itself
# (VALKEY_URL) and the scope are deployment facts and stay unset.
ENV VALKEY_KEY_PREFIX=cache
ENV VALKEY_TTL_SECONDS=120
# The native transport is dlopen'd by variant. This base is Alpine, so the
# default "gnu" would resolve to a library whose loader the image does not
# have — and the failure only surfaces at the first message, not at boot.
ENV BIN_LIBS_PATH=/app/bin-libs
ENV LIBC_VARIANT=musl

EXPOSE 3001

# Required from the platform: FUJIN_ZMQ_ENDPOINT, SERVICE_TOKEN, VALKEY_URL,
# STORAGE_TENANT_SERVICES (or STORAGE_SCOPE), MICROSERVICES.
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["bun", "run", "/app/src/converged/core/backend/src/dev.ts"]
