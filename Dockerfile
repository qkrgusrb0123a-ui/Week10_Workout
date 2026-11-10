FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force
COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/concert.db
EXPOSE 3000
CMD ["npm", "start"]
