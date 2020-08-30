# Use node, version 12 so that we get worker threads
FROM mhart/alpine-node:12

# Install openssh client
RUN apk add --no-cache openssh

# Create app directory
WORKDIR /usr/src/app

# For caching purposes, install deps without other changed files
COPY package.json package-lock.json ./

# Install deps
RUN DISABLE_OPENCOLLECTIVE=true npm ci

# Copy only react source code (to keep cache alive if nothing changed here)
COPY ./public/ ./public
COPY ./src/ ./src

# Build react app
RUN npm run build

# Clean up build deps
RUN DISABLE_OPENCOLLECTIVE=true npm ci --production

# Copy everything else over to docker image
COPY ./ ./

# Put the docker build time/date into the image
RUN date > ./build_time

# Set things up
EXPOSE 9090
CMD [ "npm", "run", "docker" ]