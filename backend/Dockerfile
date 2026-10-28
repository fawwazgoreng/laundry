FROM oven/bun:1.4-slim

RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lockb* ./

ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --ignore-scripts --trusted-dependency @prisma/engines --trusted-dependency prisma

COPY . .

EXPOSE 3000
CMD ["sh", "-c", "bun run prisma contract emit && bun run dev"]
