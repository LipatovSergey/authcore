FROM node:24-bookworm-slim AS builder

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY demo-frontend/package.json ./demo-frontend/package.json

RUN pnpm install --frozen-lockfile

COPY demo-frontend ./demo-frontend

RUN pnpm --filter demo-frontend build

FROM nginx:1.29-alpine

COPY demo-frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/demo-frontend/dist /usr/share/nginx/html

EXPOSE 80
