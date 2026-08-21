# The UI image: SSR, the SPA shell, microfrontend bundles and static assets.
#
# Like the ms image this used to be generated, for the same reason: the old
# build baked one exact microfrontend list into the delivery. Here the client
# bundle is built for *every* microfrontend in the tree and the import map that
# the browser receives is narrowed at runtime from `FRONTEND_MODULES`, so one
# image serves every solution.
#
# Build context is the repository root:
#
#   podman build -f converged/core/containers/ui.Containerfile \
#     --ignorefile converged/core/containers/containerignore \
#     --build-arg PROJECT=club -t localhost/club-ui:latest .

ARG BUN_IMAGE=docker.io/oven/bun:1.3-alpine

FROM ${BUN_IMAGE} AS builder
ARG PROJECT=converged
WORKDIR /build

COPY . /build

RUN cd /build/converged && bun install
RUN if [ "${PROJECT}" != "converged" ]; then cd "/build/${PROJECT}" && bun install; fi

RUN cd /build/converged && bun run gen
RUN if [ "${PROJECT}" != "converged" ]; then cd "/build/${PROJECT}" && bun run gen; fi

# The store worker is a separate bundle the SPA build embeds by path, so it has
# to exist before that build runs. The generator this file replaces did the
# same step in the same order.
RUN cd /build/converged/core/frontend/libraries/files/store-workers \
    && bun run src/tools/build.ts

# The client delivery. `MICROFRONTENDS` selects what gets bundled, and the
# image is built for the superset found on disk rather than for one solution —
# that is what makes a single static image serve any of them. Nothing is
# gained by omitting a bundle: an unlisted module is simply never imported.
RUN MICROFRONTENDS="$( \
      { ls -d "/build/${PROJECT}"/modules/microfrontends/*/mf-* \
             /build/converged/modules/microfrontends/*/mf-* 2>/dev/null || true; } \
      | sed 's|.*/mf-||' | sort -u | paste -sd, - \
    )" && \
    echo "delivery microfrontends: ${MICROFRONTENDS}" && \
    cd /build/converged/core/frontend/spa && \
    PROJECT_DIR=/build/converged \
    CHILD_PROJECT_DIR="/build/${PROJECT}" \
    MICROFRONTENDS="${MICROFRONTENDS}" \
    NODE_ENV=production bun run build

FROM ${BUN_IMAGE} AS runtime
ARG PROJECT=converged
WORKDIR /app

RUN apk add --no-cache libstdc++ ca-certificates

COPY --from=builder /build /app/src
COPY --from=builder /build/converged/core/containers/entrypoint.sh /app/entrypoint.sh

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
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV VALKEY_KEY_PREFIX=cache
ENV VALKEY_TTL_SECONDS=120
# The native transport is dlopen'd by variant. This base is Alpine, so the
# default "gnu" would resolve to a library whose loader the image does not
# have — and the failure only surfaces at the first message, not at boot.
# Where the client delivery built in the builder stage landed. A property of
# how this image was built, so it is set here rather than by the platform.
ENV FRONT_DELIVERY_DIR=/app/src/converged/core/frontend/spa/dist
ENV BIN_LIBS_PATH=/app/bin-libs
ENV LIBC_VARIANT=musl

EXPOSE 3000

# Required from the platform: FUJIN_ZMQ_ENDPOINT, VALKEY_URL, STORAGE_SCOPE,
# SERVICES_BASE, FRONTEND_MODULES.
ENTRYPOINT ["/app/entrypoint.sh"]
# Run from inside the landing package, not from /app.
#
# Bun picks up `jsx`/`jsxImportSource` from the tsconfig it finds for the
# working directory, and this delivery is Preact. Started anywhere else the
# JSX in the landing blocks compiles against React and the process dies on a
# missing `react/jsx-runtime`. The dev runner spawns it with the same cwd.
CMD ["sh", "-c", "cd /app/src/converged/core/frontend/landing && exec bun run src/dev.ts"]
