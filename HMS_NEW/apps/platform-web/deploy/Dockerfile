FROM node:22-alpine AS build
WORKDIR /build
RUN npm install --global pnpm@10.28.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/platform-web/package.json apps/platform-web/package.json
RUN pnpm install --frozen-lockfile --filter @hms/platform-web...
COPY packages/platform/onboarding-modules.mjs packages/platform/onboarding-modules.d.mts packages/platform/
COPY apps/platform-web apps/platform-web
RUN apk add --no-cache fontconfig font-dejavu
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SITE_ORIGIN=https://paperwhale.health \
    NEXT_PUBLIC_SEARCH_INDEXING=true \
    CAPTURE_DISABLE_BUILD_CACHE=1
RUN pnpm --filter @hms/platform-web build:server

FROM node:22-alpine AS runtime
ARG SOURCE_COMMIT
LABEL org.opencontainers.image.revision=$SOURCE_COMMIT
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /build/apps/platform-web/.next/standalone ./
USER node
EXPOSE 3000
CMD ["node", "apps/platform-web/server.js"]
