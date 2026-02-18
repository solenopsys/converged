FROM oven/bun:1

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    xz-utils \
    xvfb \
    xauth \
    libx11-6 \
    libxext6 \
    libxrender1 \
    libxrandr2 \
    libxfixes3 \
    libxi6 \
    libxcb1 \
    libdbus-1-3 \
    libfontconfig1 \
    libfreetype6 \
    libglib2.0-0 \
    libgl1 \
    libglu1-mesa \
    libnss3 \
    libasound2 \
  && rm -rf /var/lib/apt/lists/*

ARG CADASSISTANT_URL=https://www.opencascade.com/sites/default/files/private/occt/applications/cad_assistant_1.6.0_2021-10-05_lin64.appimage
RUN curl -fsSL -o /tmp/cadassistant.appimage "$CADASSISTANT_URL" \
  && chmod +x /tmp/cadassistant.appimage \
  && cd /opt \
  && /tmp/cadassistant.appimage --appimage-extract \
  && mv /opt/squashfs-root /opt/cadassistant \
  && rm -f /tmp/cadassistant.appimage

RUN cat > /usr/local/bin/cadassistant <<'EOS'
#!/usr/bin/env bash
set -euo pipefail
exec xvfb-run -a -s "-screen 0 1024x768x24" /opt/cadassistant/AppRun "$@"
EOS
RUN chmod +x /usr/local/bin/cadassistant

WORKDIR /repo
COPY package.json bun.lock ./
COPY tools/integration/nrpc ./tools/integration/nrpc
COPY tools/integration/generated/g-openscadconvertor ./tools/integration/generated/g-openscadconvertor
COPY back/external/openscadconvertor ./back/external/openscadconvertor
RUN bun install --production

WORKDIR /repo/back/external/openscadconvertor

EXPOSE 3000
CMD ["bun", "run", "src/server.ts"]
