FROM node:24-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["npm", "run", "start"]
