# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build

# ── Stage 2: Production image ────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Install only prod deps
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Uploads directory
RUN mkdir -p public/uploads/kyc

EXPOSE 3001
CMD ["node", "dist/index.js"]
