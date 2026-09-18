#!/bin/sh
set -e

# Generate runtime env-config.js from container environment variables
echo "[DOCKER-ENTRYPOINT] Generating runtime env-config.js..."

cat <<EOF > /usr/share/nginx/html/env-config.js
window.__ENV__ = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL:?VITE_SUPABASE_URL is required}",
  VITE_SUPABASE_ANON_KEY: "${VITE_SUPABASE_ANON_KEY:?VITE_SUPABASE_ANON_KEY is required}",
  VITE_ADMIN_EMAIL: "${VITE_ADMIN_EMAIL:-admin@exacoat.com}",
  VITE_APP_NAME: "${VITE_APP_NAME:-Exacoat Manager}",
  VITE_WORDPRESS_URL: "${VITE_WORDPRESS_URL:-https://exacoat.com}"
};
EOF

echo "[DOCKER-ENTRYPOINT] Runtime environment configuration ready. Starting Nginx..."
exec nginx -g "daemon off;"
