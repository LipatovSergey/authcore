FROM node:24-bookworm-slim

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY demo-frontend/package.json ./demo-frontend/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["pnpm", "start:prod"]
