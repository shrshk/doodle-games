# One image runs the whole game: the Colyseus server, which also serves the built web client.
#   docker build -t snakes-doodle .
#   docker run -p 2567:2567 snakes-doodle      -> http://localhost:2567

FROM node:22.20.0-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/engine/package.json packages/engine/
COPY packages/boards/package.json packages/boards/
COPY packages/protocol/package.json packages/protocol/
COPY packages/ui-doodle/package.json packages/ui-doodle/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# the server bundle inlines the workspace packages; this keeps only its npm runtime dependencies
RUN pnpm --filter @snakes-doodle/server deploy --prod --legacy /out \
  && cp -r apps/server/dist /out/dist \
  && cp -r apps/web/dist /out/client

FROM node:22.20.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=2567 HOST=0.0.0.0 CLIENT_DIR=/app/client
COPY --from=build /out ./
USER node
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/__healthcheck').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
