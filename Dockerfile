FROM node:22-bookworm-slim

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

COPY lib/db/package.json                  lib/db/
COPY lib/api-spec/package.json            lib/api-spec/
COPY lib/api-zod/package.json             lib/api-zod/
COPY lib/api-client-react/package.json    lib/api-client-react/
COPY artifacts/api-server/package.json    artifacts/api-server/
COPY artifacts/workout-tracker/package.json artifacts/workout-tracker/

RUN pnpm install --frozen-lockfile

COPY lib/                       lib/
COPY artifacts/api-server/      artifacts/api-server/
COPY artifacts/workout-tracker/ artifacts/workout-tracker/

ENV NODE_ENV=production PORT=3000 BASE_PATH=/
RUN pnpm --filter @workspace/workout-tracker run build

RUN pnpm --filter @workspace/api-server run build

RUN cp -r artifacts/workout-tracker/dist/public artifacts/api-server/dist/public

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PORT=8080
EXPOSE 8080

CMD ["/entrypoint.sh"]
