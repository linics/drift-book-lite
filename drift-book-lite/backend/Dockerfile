FROM node:20-bookworm

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate

EXPOSE 8080

CMD ["sh", "-c", "npx prisma db push && npm start"]
