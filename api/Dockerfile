FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

ENV HOST=0.0.0.0
ENV PORT=3001

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
