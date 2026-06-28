# Node 22 (geckos v3 uses pure-JS werift WebRTC — no native build needed).
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 8080/tcp
EXPOSE 20000/udp
CMD ["node", "index.js"]
