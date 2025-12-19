# --- Stage 1: Build the React App ---
FROM node:18-alpine as build
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# CRITICAL CHANGE: Declare the build argument
ARG VITE_API_URL
# Set it as an environment variable so the build process can see it
ENV VITE_API_URL=$VITE_API_URL

# Now build the app with the variable "baked in"
RUN npm run build

# --- Stage 2: Serve the App ---
FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
CMD serve -s dist -l $PORT
