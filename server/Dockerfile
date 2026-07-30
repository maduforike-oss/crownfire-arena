FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY server ./server
RUN npm run build:server

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/server-dist ./server-dist
COPY server/schema.sql ./server/schema.sql
EXPOSE 8787
CMD ["node", "server-dist/index.js"]
