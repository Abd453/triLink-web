# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --frozen-lockfile || npm install

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_CHAT_WS_URL
ARG NEXT_PUBLIC_CHAT_SOCKET_PATH=/socket.io
ARG NEXT_PUBLIC_AI_CORE_URL
ARG NEXT_PUBLIC_AI_INTERNAL_KEY
ARG NEXT_PUBLIC_AUTH_LOGIN_PATH=/api/auth/login
ARG NEXT_PUBLIC_AUTH_REFRESH_PATH=/api/auth/refresh
ARG NEXT_PUBLIC_FRONTEND_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_CHAT_WS_URL=${NEXT_PUBLIC_CHAT_WS_URL}
ENV NEXT_PUBLIC_CHAT_SOCKET_PATH=${NEXT_PUBLIC_CHAT_SOCKET_PATH}
ENV NEXT_PUBLIC_AI_CORE_URL=${NEXT_PUBLIC_AI_CORE_URL}
ENV NEXT_PUBLIC_AI_INTERNAL_KEY=${NEXT_PUBLIC_AI_INTERNAL_KEY}
ENV NEXT_PUBLIC_AUTH_LOGIN_PATH=${NEXT_PUBLIC_AUTH_LOGIN_PATH}
ENV NEXT_PUBLIC_AUTH_REFRESH_PATH=${NEXT_PUBLIC_AUTH_REFRESH_PATH}
ENV NEXT_PUBLIC_FRONTEND_URL=${NEXT_PUBLIC_FRONTEND_URL}
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
