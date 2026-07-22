# Lab manager — small Node image. Mounts the docker socket at runtime so it can
# spawn Tier-3 containers (see docker-compose). Sized for the 5GB budget.
FROM node:22-alpine AS build
WORKDIR /app
# Build toolchain for node-pty's native addon (the interactive terminal pty).
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
# Compile TS, then drop devDeps so we carry only the prod node_modules (incl. the
# already-built node-pty binary) into the runtime image — no rebuild, no toolchain.
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# docker CLI so ContainerManager can shell out to spawn/kill Tier-3 targets;
# libstdc++ is the runtime lib the node-pty native addon links against.
RUN apk add --no-cache docker-cli libstdc++
COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/index.js"]
