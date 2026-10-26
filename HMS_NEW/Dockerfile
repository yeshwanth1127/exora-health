# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app
ARG VITE_OIDC_AUTHORITY
ARG VITE_OIDC_CLIENT_ID
ARG VITE_OIDC_AUDIENCE
ARG VITE_OIDC_SCOPE="openid profile email"
ENV VITE_OIDC_AUTHORITY=$VITE_OIDC_AUTHORITY
ENV VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID
ENV VITE_OIDC_AUDIENCE=$VITE_OIDC_AUDIENCE
ENV VITE_OIDC_SCOPE=$VITE_OIDC_SCOPE
ARG VITE_HMS_DEV_LOGIN=false
ARG VITE_HMS_DEFAULT_SUBJECT=admin
ENV VITE_HMS_DEV_LOGIN=$VITE_HMS_DEV_LOGIN
ENV VITE_HMS_DEFAULT_SUBJECT=$VITE_HMS_DEFAULT_SUBJECT
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json vitest.config.ts ./
COPY apps ./apps
COPY packages ./packages
COPY db ./db
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile
RUN pnpm public:build && VITE_BOOKING_MODE=hms pnpm website:build && pnpm editorial:build && pnpm staff:build

FROM node:22-bookworm-slim AS runtime

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV SERVE_WEB_ASSETS=1

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/tsconfig.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages
COPY --from=build /app/db ./db
COPY --from=build /app/scripts ./scripts
COPY docker/tenant-entrypoint.sh /usr/local/bin/tenant-entrypoint
RUN chmod +x /usr/local/bin/tenant-entrypoint && mkdir -p /data/comms && chown -R node:node /app /data

USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["tenant-entrypoint"]
