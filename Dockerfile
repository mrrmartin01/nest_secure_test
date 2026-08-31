# ---- dependencies ----
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app

# prisma.config.ts requires DATABASE_URL at generate/postinstall time (not a live DB)
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

COPY package.json bun.lock ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN bun install --frozen-lockfile

# ---- build ----
FROM deps AS build
WORKDIR /app

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN bun run prisma:generate \
  && bun run build

# ---- production ----
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/package.json /app/bun.lock ./
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts ./
COPY --chown=app:app docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh

USER app
EXPOSE 3000

ENTRYPOINT ["./docker/entrypoint.sh"]
