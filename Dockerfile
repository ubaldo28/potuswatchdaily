# Drop-in replacement for your existing Dockerfile.
# Smaller (alpine), reproducible (lockfile), production-only deps,
# non-root user, healthcheck-aware, runs faster.

FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Install only production deps using the lockfile.
# If you don't have package-lock.json yet:
#    1. run `npm install` once locally
#    2. commit the resulting package-lock.json
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy source (use .dockerignore to exclude node_modules, .git, .env, etc.)
COPY . .

# Drop root
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

# Railway sets PORT; container should bind to it.
EXPOSE 3000

# Optional: container-level healthcheck (Railway also has its own)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --quiet --spider --tries=1 http://127.0.0.1:${PORT:-3000}/healthz || exit 1

CMD ["node", "localserver.js"]
