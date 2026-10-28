FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @bookleaf/api...
COPY apps/api apps/api
RUN pnpm --filter @bookleaf/api db:generate && pnpm --filter @bookleaf/api build
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
