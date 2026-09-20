FROM alpine:3.22

ARG ZIG_ARCH=x86_64
ARG ZIG_VERSION=0.16.0

RUN apk add --no-cache \
      bash \
      build-base \
      ca-certificates \
      cmake \
      git \
      linux-headers \
      ninja \
      patch \
      perl \
      python3 \
      unzip \
      wget \
      xz \
    && case "$ZIG_ARCH" in \
         x86_64|aarch64) ;; \
         *) echo "unsupported Zig architecture: $ZIG_ARCH" >&2; exit 2 ;; \
       esac \
    && wget -q "https://ziglang.org/download/${ZIG_VERSION}/zig-${ZIG_ARCH}-linux-${ZIG_VERSION}.tar.xz" -O /tmp/zig.tar.xz \
    && mkdir -p /opt \
    && tar -xJf /tmp/zig.tar.xz -C /opt \
    && mv "/opt/zig-${ZIG_ARCH}-linux-${ZIG_VERSION}" /opt/zig \
    && rm /tmp/zig.tar.xz

ENV PATH="/opt/zig:$PATH"
WORKDIR /src
ENTRYPOINT ["/bin/bash"]
