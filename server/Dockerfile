# Step 1: Base Image
FROM node:18

# Step 2: Set working directory
WORKDIR /app

# Step 3: Copy package.json first (better caching)
COPY package*.json ./

# Step 4: Install dependencies
RUN npm install

# Step 5: Copy the rest of the backend files
COPY . .

# Step 6: Expose server port
EXPOSE 3000

# Step 7: Start server
CMD ["node", "server.js"]
