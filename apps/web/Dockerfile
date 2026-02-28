# ─────────────────────────────────────────────────────────────────
# Stage 1: deps — install all dependencies (including devDeps for build)
# ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# openssl is required by Prisma's query engine
RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json* ./
# Use npm ci when a lock file exists; npm install for first-time setup
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ─────────────────────────────────────────────────────────────────
# Stage 2: builder — generate Prisma client + Next.js production build
# ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client targeting the linux-musl-openssl-3.0.x binary
RUN npx prisma generate

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
# Skip runtime env validation — vars are not available at build time
ENV SKIP_ENV_VALIDATION=1

# NEXT_PUBLIC_ vars must be present at build time so Next.js inlines them
# into the client bundle. Passed from docker-compose.yml as build args.
ARG NEXT_PUBLIC_TYPESENSE_HOST=localhost
ARG NEXT_PUBLIC_TYPESENSE_PORT=8108
ARG NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_KEY
ENV NEXT_PUBLIC_TYPESENSE_HOST=$NEXT_PUBLIC_TYPESENSE_HOST
ENV NEXT_PUBLIC_TYPESENSE_PORT=$NEXT_PUBLIC_TYPESENSE_PORT
ENV NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_KEY=$NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_KEY

RUN npm run build

# ─────────────────────────────────────────────────────────────────
# Stage 3: runner — minimal production image (non-root)
# ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat wget

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema + migrations for runtime migrations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
