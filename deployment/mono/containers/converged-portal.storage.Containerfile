# Auto-generated Containerfile
# Project: converged-portal
# Role: storage

FROM alpine:3.20 AS runtime
WORKDIR /app

COPY clarity/projects/converged-portal/native/storage/zig-out/bin/storage-x86_64-musl /app/storage
RUN chmod +x /app/storage && mkdir -p /app/data /app/socket

CMD ["/app/storage", "start", "--data-dir", "/app/data", "--socket", "/app/socket/storage.sock"]