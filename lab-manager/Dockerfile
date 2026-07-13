# Lab manager — small Node image. Mounts the docker socket at runtime so it can
# spawn Tier-3 containers (see docker-compose). Sized for the 5GB budget.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# docker CLI so ContainerManager can shell out to spawn/kill Tier-3 targets
RUN apk add --no-cache docker-cli
EXPOSE 4000
CMD ["node", "dist/index.js"]
