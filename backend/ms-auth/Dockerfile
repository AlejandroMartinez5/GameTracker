FROM node:24-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node src ./src

ENV NODE_ENV=production
USER node
EXPOSE 3003
CMD ["node", "src/server.js"]
