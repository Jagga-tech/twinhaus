# Two-stage build: compile the web app, then serve the static bundle.
# The base image is provided by the Home Assistant add-on builder via $BUILD_FROM.
ARG BUILD_FROM=node:20-alpine

# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps
COPY tsconfig.base.json ./
RUN npm ci
RUN npm run build --workspace @twinhaus/web

# --- Runtime stage ---
FROM ${BUILD_FROM}
RUN apk add --no-cache nodejs npm || true
WORKDIR /app
COPY --from=build /src/apps/web/dist ./dist
# `serve` hosts the SPA on the ingress port.
RUN npm install -g serve@14
EXPOSE 8099
CMD ["serve", "-s", "dist", "-l", "8099"]
