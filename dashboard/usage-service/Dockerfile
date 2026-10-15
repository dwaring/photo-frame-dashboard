FROM node:22-bookworm-slim
RUN npm install --global @openai/codex@0.162.1
WORKDIR /app
COPY codex.js server.js ./
COPY package.json ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
