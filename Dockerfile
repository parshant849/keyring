# Dockerfile
FROM debian:bookworm-slim

# install required packages (openscad, nodejs, npm, fonts)
RUN apt-get update && apt-get install -y \
    openscad \
    curl \
    ca-certificates \
    gnupg \
    build-essential \
    fonts-liberation \
    fontconfig \
    nodejs \
    npm \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# copy app source
COPY package.json package-lock.json* /app/
RUN npm install --production

COPY . /app

EXPOSE 3000
CMD ["node", "server.js"]
