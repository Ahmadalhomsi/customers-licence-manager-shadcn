# Use the official Node.js 20 Alpine image as base
FROM node:20.14.0-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm@9

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy only lockfile and manifest for better caching
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies including dev dependencies for Prisma
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Create the generated directory with proper permissions
RUN mkdir -p app/generated && chmod -R 777 app/generated

# Generate Prisma Client before building
RUN pnpm prisma generate

# Build the application
RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy necessary files including node_modules for Prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/app/generated ./app/generated

RUN apk add --no-cache curl

# Fix permissions for the generated directory
RUN mkdir -p app/generated && chown -R nextjs:nodejs app/generated && chmod -R 755 app/generated

# Permissions for .next directory
RUN mkdir -p .next && chown nextjs:nodejs .next

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the Next.js application with migrations
CMD sh -c "pnpm prisma migrate deploy && node server.js"