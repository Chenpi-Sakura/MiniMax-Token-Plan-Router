FROM node:20-alpine AS builder

WORKDIR /app

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

RUN apk add --no-cache python3 make g++ py3-setuptools

COPY package*.json ./

ENV npm_config_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/sqlite3

RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev --registry=https://registry.npmmirror.com

FROM node:20-alpine

WORKDIR /app

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
    && apk add --no-cache dumb-init \
    && mkdir -p /app/data \
    && chown node:node /app/data

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --chown=node:node server.js ./
COPY --chown=node:node init.sql .
COPY --chown=node:node src ./src

USER node

EXPOSE 3000

ENV NODE_ENV=production
ENV DB_DIR=/app/data

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]