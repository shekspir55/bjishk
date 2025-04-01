FROM node:18-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/tsconfig.json frontend/tsconfig.node.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:18-alpine AS backend-builder
WORKDIR /backend
COPY backend/package.json backend/tsconfig.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY backend/package.json ./
RUN npm install --production
COPY --from=backend-builder /backend/dist ./dist
COPY --from=frontend-builder /frontend/dist ./public
EXPOSE 3000
CMD ["node", "dist/server.js"] 