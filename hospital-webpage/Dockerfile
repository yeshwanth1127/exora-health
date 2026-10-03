FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ARG VITE_VOICE_URL
ARG VITE_JITSI_DOMAIN
ARG VITE_HOSPITAL_SLUG
ENV VITE_API_URL=$VITE_API_URL VITE_VOICE_URL=$VITE_VOICE_URL VITE_JITSI_DOMAIN=$VITE_JITSI_DOMAIN VITE_HOSPITAL_SLUG=$VITE_HOSPITAL_SLUG
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
