FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build -- --configuration production

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx-prod.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080