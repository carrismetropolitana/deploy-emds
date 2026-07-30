# # #
# DEFINE THE BASE IMAGE

FROM node:24-alpine AS base

ENV MODULE=server

WORKDIR /app


# # #
# BUILDER STAGE

FROM base AS builder

# Install dependencies before copying source code to preserve the dependency layer.
COPY package.json package-lock.json ./
COPY apps/${MODULE}/package.json ./apps/${MODULE}/package.json

RUN npm install

# Build only the server workspace.
COPY tsconfig.json ./
COPY apps/${MODULE}/tsconfig.json ./apps/${MODULE}/tsconfig.json
COPY apps/${MODULE}/src ./apps/${MODULE}/src

RUN npm run build --workspace @carrismetropolitana/deploy-emds-${MODULE}


# # #
# RUNNER STAGE

FROM base AS runner

ENV NODE_ENV=production

# Install only the server's production dependency graph.
COPY package.json package-lock.json ./
COPY apps/${MODULE}/package.json ./apps/${MODULE}/package.json

RUN npm install --omit=dev --ignore-scripts \
  && npm cache clean --force

COPY --chown=node:node --from=builder \
  /app/apps/${MODULE}/dist \
  ./apps/${MODULE}/dist

WORKDIR /app/apps/server

USER node

EXPOSE 6192

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:6192/health >/dev/null || exit 1

CMD ["node", "--enable-source-maps", "dist/api/server.js"]
