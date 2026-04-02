# Use the official Node.js image
FROM node:18

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your app's code
COPY . .

# Your app listens on port 8080 (matching your Back4app settings)
EXPOSE 8080

# The command to run your app
CMD [ "node", "server.js" ]