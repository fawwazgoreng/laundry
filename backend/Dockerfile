FROM oven/bun:1-slim

RUN apt-get update && apt-get install -y ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cocok untuk bun.lock maupun bun.lockb
COPY package.json bun.lock* ./

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY . .

RUN bun run prisma contract emit

EXPOSE 3000
CMD ["bun", "run", "dev"]