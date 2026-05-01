FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/unit-economics/package.json packages/unit-economics/package.json

RUN npm ci

COPY . .

RUN npm run prisma:generate
RUN npm run build -w apps/api
RUN npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app ./

EXPOSE 3001

CMD ["sh", "-c", "npm run prisma:deploy -w apps/api && npm run start -w apps/api"]
