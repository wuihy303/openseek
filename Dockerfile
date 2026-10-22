FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node dist ./dist
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
