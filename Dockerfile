# Stage 1: Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Declare build arguments so Dokploy environment variables pass to Vite build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_ADMIN_EMAIL
ARG VITE_APP_NAME
ARG VITE_WORDPRESS_URL
ARG VITE_N8N_WEBHOOK_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_ADMIN_EMAIL=$VITE_ADMIN_EMAIL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_WORDPRESS_URL=$VITE_WORDPRESS_URL
ENV VITE_N8N_WEBHOOK_URL=$VITE_N8N_WEBHOOK_URL

# Install dependencies first for optimal Docker layer caching
COPY package*.json ./
RUN npm ci

# Copy source code and build production bundle
COPY . .
RUN npm run build

# Stage 2: Production Nginx Server with Runtime Environment Generator
FROM nginx:alpine

# Remove default nginx configurations
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from builder stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy and setup entrypoint script for dynamic runtime env-config.js generation
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

# Expose both HTTP ports (80 and 3000) for Dokploy and Traefik
EXPOSE 80 3000

# Execute dynamic runtime configuration generator before launching Nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
