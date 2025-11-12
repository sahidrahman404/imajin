# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.16.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Install pnpm
ARG PNPM_VERSION=10.17.0
RUN npm install -g pnpm@$PNPM_VERSION


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# Copy application code
COPY . .

# Build application
RUN pnpm run build

# Remove development dependencies
RUN pnpm prune --prod


# Final stage for app image
FROM base

# Install minimal build dependencies for native modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential python-is-python3 && \
    rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=build /app /app

# Rebuild better-sqlite3 for the correct architecture
RUN cd /app && pnpm rebuild better-sqlite3

# Clean up build dependencies to minimize image size
RUN apt-get remove -y build-essential python-is-python3 && \
    apt-get autoremove -y && \
    apt-get clean

# Copy and make startup script executable
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "/app/start.sh" ]
