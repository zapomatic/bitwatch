# Build stage for React client
FROM --platform=$BUILDPLATFORM node:22-alpine as client-builder
WORKDIR /app
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Build stage for Node.js server
FROM --platform=$TARGETPLATFORM node:22-alpine
WORKDIR /app

# Copy server files
COPY server/ ./server/
COPY package*.json ./

# Copy built client files
COPY --from=client-builder /app/build ./client/build

# Install production dependencies
RUN npm install --production

# Set ownership of the app directory to UID 1000
RUN chown -R 1000:1000 /app

# Switch to non-root user
USER 1000

# Expose port
EXPOSE 3117

# Start the server
CMD ["node", "server/index.js"]