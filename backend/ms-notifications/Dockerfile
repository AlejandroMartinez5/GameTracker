FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY sql ./sql

ENV NODE_ENV=production
USER node

EXPOSE 3008

CMD ["npm", "start"]

