FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY sql ./sql
USER node
EXPOSE 3007
CMD ["npm", "start"]