# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force


# ── Stage 2: Production Image ─────────────────────────────────────────────────
FROM node:20-alpine AS production

# Install Unicode fonts (Arabic support for PDF rendering)
RUN apk add --no-cache ttf-dejavu

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001

WORKDIR /app

# Copy deps from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY src/ ./src/
COPY package.json ./

# Create required directories with correct ownership
RUN mkdir -p uploads/exams uploads/student-exams uploads/reports uploads/temp logs \
    && chown -R nodeuser:nodejs /app

USER nodeuser

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Graceful shutdown support
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
