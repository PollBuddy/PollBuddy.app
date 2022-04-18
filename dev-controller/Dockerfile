FROM node:13-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install --production

COPY views ./views
COPY index.js ./index.js
COPY kubernetes.js ./kubernetes.js


EXPOSE 3000

CMD node index.js