# Snakes & Ladders in one image: the Colyseus server, which also serves the built web client.
#   docker build -t snakes-doodle .
#   docker run -p 2567:2567 snakes-doodle      -> http://localhost:2567

FROM node:22.20.0-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY games/snakes-and-ladders/apps/web/package.json games/snakes-and-ladders/apps/web/
COPY games/snakes-and-ladders/apps/server/package.json games/snakes-and-ladders/apps/server/
COPY games/snakes-and-ladders/packages/engine/package.json games/snakes-and-ladders/packages/engine/
COPY games/snakes-and-ladders/packages/boards/package.json games/snakes-and-ladders/packages/boards/
COPY games/snakes-and-ladders/packages/protocol/package.json games/snakes-and-ladders/packages/protocol/
COPY games/ludo/apps/web/package.json games/ludo/apps/web/
COPY games/ludo/packages/engine/package.json games/ludo/packages/engine/
COPY packages/ui-doodle/package.json packages/ui-doodle/
COPY packages/doodle-sound/package.json packages/doodle-sound/
COPY packages/doodle-rooms/package.json packages/doodle-rooms/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# the server bundle inlines the workspace packages; this keeps only its npm runtime dependencies
RUN pnpm --filter @snakes-doodle/server deploy --prod --legacy /out \
  && cp -r games/snakes-and-ladders/apps/server/dist /out/dist \
  && cp -r games/snakes-and-ladders/apps/web/dist /out/client

FROM node:22.20.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=2567 HOST=0.0.0.0 CLIENT_DIR=/app/client
COPY --from=build /out ./
USER node
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/__healthcheck').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
