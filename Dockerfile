FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx-prod.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000