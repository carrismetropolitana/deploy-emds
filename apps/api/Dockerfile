# # #
# DEFINE THE BASE IMAGE

FROM node:lts-slim AS base

ENV MODULE=api

RUN npm install --global turbo@^2


# # #
# PRUNER STAGE

FROM base AS pruner

WORKDIR /app

COPY . .

RUN turbo prune @carrismetropolitana/deploy-emds-api --docker


# # #
# BUILDER STAGE

FROM base AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y python3 build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY --from=pruner /app/out/json/ .

RUN npm ci

COPY --from=pruner /app/out/full/ .

RUN turbo run build --filter=@carrismetropolitana/deploy-emds-api


# # #
# RUNNER STAGE

FROM gcr.io/distroless/nodejs24-debian13 AS runner

ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV PORT=6192

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

EXPOSE 6192

CMD ["./dist/launcher.js"]