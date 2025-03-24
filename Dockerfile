# Build stage for React client
FROM node:20-alpine as client-builder
WORKDIR /app
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Build stage for Node.js server
FROM node:20-alpine
WORKDIR /app

# Copy server files
COPY server/ ./server/
COPY package*.json ./

# Copy built client files
COPY --from=client-builder /app/build ./client/build

# Install production dependencies
RUN npm install --production

# Expose port
EXPOSE 3117

# Start the server
CMD ["node", "server/index.js"]