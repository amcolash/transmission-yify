# Dependency Stage
FROM mhart/alpine-node:10 AS dependencies

# Create app directory
WORKDIR /usr/src/app

# For caching purposes, install deps without other changed files
COPY package.json package-lock.json ./

# Install deps
RUN npm ci

##########################################################################

# App Build Stage
FROM mhart/alpine-node:10 AS build

# Install openssh client
RUN apk add openssh

# Create app directory
WORKDIR /usr/src/app

# Copy dependencies over
COPY --from=dependencies /usr/src/app/node_modules/ ./node_modules

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

# Set things up
EXPOSE 9000
CMD [ "npm", "run", "docker" ]