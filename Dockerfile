# Start with Ubuntu 22.04 as the base operating system
FROM ubuntu:22.04

# Prevent apt from asking interactive questions during install
ENV DEBIAN_FRONTEND=noninteractive

# Update package list and install required software
RUN apt-get update && apt-get install -y \
    openscad \
    nodejs \
    npm \
    xvfb \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Create and set the working directory inside container
WORKDIR /app

# Copy package.json and package-lock.json first (for better caching)
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --production

# Copy your server code
COPY server.js ./

# Tell Docker that the app listens on port 3000
EXPOSE 3000

# Set up virtual display for OpenSCAD (needed for headless rendering)
ENV DISPLAY=:99

# Start Xvfb (virtual display) in background, then start Node server
CMD Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 & node server.js
