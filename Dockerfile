# Use Node.js 20 LTS
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy application code
COPY . .

# Expose port (Cloud Run will set PORT environment variable)
ENV PORT=8080
EXPOSE 8080

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["node", "server.js"]
