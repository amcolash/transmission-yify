# Dependency Stage
FROM mhart/alpine-node:8 AS dependencies

# Create app directory
WORKDIR /usr/src/app

# For caching purposes, install deps without other changed files
COPY package.json package-lock.json ./

# Install deps
RUN npm ci

##########################################################################

# App Build Stage
FROM mhart/alpine-node:8 AS build

# Create app directory
WORKDIR /usr/src/app

# Copy dependencies over
COPY --from=dependencies /usr/src/app/node_modules/ ./node_modules

# Copy everything to docker image (this invalidates the cache now...)
COPY ./ ./

# Build react app
RUN npm run build

# Clean up build deps
RUN npm ci --production

# Set things up
EXPOSE 9000
CMD [ "npm", "run", "docker" ]