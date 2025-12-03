# frontend/Dockerfile — продакшн-версия
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

# Лёгкий nginx для статики
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html

# Наш мини-конфиг nginx
COPY nginx-prod.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080