FROM node:21.7.3-alpine3.20

RUN apk update && \
    apk upgrade && \
    apk add curl

# Install pnpm
RUN npm i -g pnpm

# Install packages via pnpm
RUN pnpm i

# Build project
RUN pnpm run build

# Init workspace
RUN mkdir -p /app

# Entry
COPY . /app
WORKDIR /app

# Exposing port
EXPOSE 4000

# CMD
CMD ["pnpm", "start"]
