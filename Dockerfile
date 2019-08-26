# Use node
FROM mhart/alpine-node:10

# Install openssh client
RUN apk add --no-cache openssh

# Create app directory
WORKDIR /usr/src/app

# For caching purposes, install deps without other changed files
COPY package.json package-lock.json ./

# Install deps
RUN npm ci

# Copy only react source code (to keep cache alive if nothing changed here)
COPY ./public/ ./public
COPY ./package.json ./package-lock.json ./
COPY ./src/ ./src

# Build react app
RUN npm run build

# Clean up build deps
RUN npm ci --production

# Copy everything else over to docker image
COPY ./ ./

# Put the docker build time/date into the image
RUN date > ./build_time

# Set things up
EXPOSE 9000
CMD [ "npm", "run", "docker" ]