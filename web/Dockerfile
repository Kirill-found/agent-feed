FROM node:20-alpine

WORKDIR /app

# Install bun
RUN npm install -g bun

COPY package.json bun.lock* ./
RUN bun install

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=https://agent-feed-api-production.up.railway.app

RUN bun run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["bun", "run", "start"]
