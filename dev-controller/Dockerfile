FROM node:16-bullseye

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install --production

COPY views ./views
COPY index.js ./index.js
COPY kubernetes.js ./kubernetes.js


RUN apt update && \
      apt install -y curl && \
      curl -LO https://storage.googleapis.com/kubernetes-release/release/`curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt`/bin/linux/amd64/kubectl && \
      chmod +x ./kubectl && \
      mv ./kubectl /usr/local/bin/kubectl


EXPOSE 3000

CMD node index.js