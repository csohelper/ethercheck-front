FROM node:20-alpine

COPY package*.json ./

RUN npm install

COPY . .

WORKDIR /app

ENV HOST=0.0.0.0

ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]