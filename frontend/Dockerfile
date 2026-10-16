FROM oven/bun:1.4-slim AS build
WORKDIR /app

COPY package.json ./

COPY bun.lock ./

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/config.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]