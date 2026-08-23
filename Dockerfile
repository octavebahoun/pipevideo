FROM node:20-alpine AS base

# 1. Installer les dépendances
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. Builder le projet Next.js
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
# Générer le client Prisma
RUN npx prisma generate
RUN npm run next-build

# 3. Étape runner de production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Outils appelés par le pipeline depuis le conteneur, pas seulement au build :
#   ffmpeg/ffprobe — voice:fx applique la réverbération, runpod.ts compte les
#     frames des clips pour valider qu'ils ne sont pas tronqués
#   openssh-client — runpodClient.ts pilote le pod GPU en SSH (kill switch,
#     rclone vers R2). Sans lui, `npm run runpod` échoue au premier appel
# Les oublier ne casse pas le démarrage : ça casse le rendu, plusieurs minutes
# après le lancement.
RUN apk add --no-cache ffmpeg openssh-client

COPY --from=builder /app/public ./public
# Kept as a pristine reference copy: /app/public is a mounted volume (see
# docker-compose.yml) that persists generated assets across restarts, so it
# starts out empty on a fresh volume. entrypoint.sh seeds it from this copy.
COPY --from=builder /app/public ./.image-public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/rmo.config.ts ./rmo.config.ts
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

ENTRYPOINT ["./entrypoint.sh"]
CMD ["npm", "run", "start"]
