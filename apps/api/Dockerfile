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

RUN turbo prune @carrismetropolitana/deploy-emds-${MODULE} --docker


# # #
# BUILDER STAGE

FROM base AS builder

WORKDIR /app

RUN apt-get update
RUN apt-get install -y python3 build-essential
RUN rm -rf /var/lib/apt/lists/*

COPY --from=pruner /app/out/json/ .

RUN npm ci

COPY --from=pruner /app/out/full/ .

RUN turbo run build --filter=@carrismetropolitana/deploy-emds-${MODULE}


# # #
# RUNNER STAGE

FROM gcr.io/distroless/nodejs24-debian13 AS runner

ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV PORT=6192

WORKDIR /app

COPY --from=pruner /app/out/json/ .

RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=builder \
  /app/apps/${MODULE}/dist \
  ./apps/${MODULE}/dist

WORKDIR /app/apps/${MODULE}

EXPOSE 6192

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:6192/health >/dev/null || exit 1

CMD ["node", "--enable-source-maps", "dist/launcher.js"]
