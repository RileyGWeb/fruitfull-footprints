# Production image for the shared sandbox host (see ../infra/README.md). Multi-stage so the final
# image only carries the standalone server output, not devDependencies or the full node_modules.
#
# BACKEND_URL is not passed as a build arg here: nginx on the host intercepts /api/* with its own
# FastCGI location before it ever reaches Next (see infra/README.md), so next.config.ts's own
# `rewrites()` to BACKEND_URL never fires in production — its default (127.0.0.1, unreachable from
# this container) is harmless dead code on this deployment.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
