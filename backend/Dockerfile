FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S dokgroup && adduser -S dokuser -G dokgroup

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY migrations ./migrations

USER dokuser
EXPOSE 4000
# Run pending migrations, then start the server.
# migrate.js is idempotent (tracks applied files in schema_migrations),
# so running it on every container start is safe.
CMD ["sh", "-c", "node dist/lib/migrate.js && node dist/index.js"]
