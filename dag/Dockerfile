FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock ./

# Install all dependencies for migration support
RUN bun install

# # Copy all necessary files
COPY src ./src
COPY tsconfig.json ./


# Create directory for database
RUN mkdir -p /app/data

# Set permissions
RUN chown -R 1000:1000 /app

USER 1000

CMD ["bun", "run", "src/server/index.ts"]