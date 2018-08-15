FROM mhart/alpine-node:8

# Create app directory
WORKDIR /usr/src/app

# For caching purposes, install deps without other changed files
COPY package.json package-lock.json ./

# Install deps (can be cached)
RUN npm install --only=dev

# Copy everything to docker image (this invalidates the cache now...)
COPY ./ ./

# Build react app
RUN npm run-script build

# Clean up build deps
RUN rm -rf node_modules

# Start things up
EXPOSE 9000
CMD [ "npm", "run-script", "docker" ]