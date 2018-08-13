FROM mhart/alpine-node:8

# Create app directory
WORKDIR /usr/src/app

# Copy everything to docker image
COPY . .

# Install deps
RUN npm install

# Build react app
RUN npm run-script build

# Clean things up now that things are built
RUN npm prune --production

# Start things up
EXPOSE 9000
CMD [ "npm", "run-script", "docker" ]