# RERUN — one image that serves both the client and the WebSocket server.
# Build context is this directory (rerun/), because the server imports ../shared.
#
#   docker build -t rerun .
#   docker run -p 8787:8787 rerun

FROM node:22-alpine AS client
WORKDIR /build
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm ci --no-audit --no-fund || (cd /build/client && npm install --no-audit --no-fund)
COPY shared ./shared
COPY client ./client
RUN cd client && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
COPY shared ./shared
COPY server ./server
COPY --from=client /build/client/dist ./client/dist
EXPOSE 8787
ENV PORT=8787
CMD ["node", "server/index.js"]
