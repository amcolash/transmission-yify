FROM mhart/alpine-node:8

# Create app directory
WORKDIR /usr/src/app

# For caching purposes, install deps without other changed files
COPY "package.json" .

# Install deps (can be cached)
RUN npm install

# Copy everything to docker image (this invalidates the cache now...)
COPY . .

# Build react app
RUN npm run-script build

# Clean things up now that things are built
RUN npm prune --production

# Start things up
EXPOSE 9000
CMD [ "npm", "run-script", "docker" ]