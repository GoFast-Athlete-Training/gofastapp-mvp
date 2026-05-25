# Build from gofastapp-mvp repo root:
#   docker build -f services/garmin-activity-detail-ingest/Dockerfile -t garmin-activity-detail-ingest .

FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate --schema=./prisma/schema.prisma

COPY lib ./lib
COPY services/garmin-activity-detail-ingest ./services/garmin-activity-detail-ingest

WORKDIR /app/services/garmin-activity-detail-ingest
RUN npm install

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
