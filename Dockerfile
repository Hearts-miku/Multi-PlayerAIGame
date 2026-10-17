FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
COPY package*.json ./
RUN npm ci --omit=dev && mkdir -p /app/data && chown node:node /app/data
COPY server ./server
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "server/index.js"]
