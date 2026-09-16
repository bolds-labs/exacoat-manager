# Dokploy Production Deployment Guide

Deploying the **Artmatter Artist Manager ERP** to Dokploy with automatic zero-downtime builds, Nginx caching, and health checks.

---

## 1. Prerequisites
- Access to your Dokploy panel.
- GitHub connection authorized with `bolds-labs/artmatter-artist-manager`.
- Supabase Project Credentials.

---

## 2. Step-by-Step Deployment in Dokploy

### Step 1: Create a New Application
1. In Dokploy Dashboard, navigate to your **Project** and click **Create Application**.
2. Name the application: `artmatter-artist-manager`.
3. Choose **GitHub** as the source provider and select `bolds-labs/artmatter-artist-manager`.
4. Branch: `main`.

### Step 2: Configure Build Type
- **Build Type**: `Dockerfile`
- **Dockerfile Path**: `./Dockerfile`
- **Context Path**: `./`

### Step 3: Set Environment Variables
In the **Environment** tab of your Dokploy application, add:

```ini
# Supabase Production Database
VITE_SUPABASE_URL=https://vamdbdbbltxjfcrsbgsq.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_9gtK4fqDLQKrVC9VXzSjHA_iDEbzmjn

# Public Manager Configuration
VITE_ADMIN_EMAIL=admin@artmatter.co

# Platform Configuration
VITE_APP_NAME=Artmatter Artist Hub
VITE_WORDPRESS_URL=https://cms.artmatter.co
VITE_N8N_WEBHOOK_URL=https://node.exacoat.com
```

All `VITE_*` values are public browser configuration. Never set a Supabase service-role key, database password, provider API key, or Manager password under a `VITE_*` name.

The Manager routes WordPress requests through `/cms/` in production to avoid browser CORS dependencies. On the `cms.artmatter.co` host, remove any LiteSpeed, Apache, control-panel, or CDN rule that adds `Access-Control-Allow-Origin: *` to `/wp-json/`; Artmatter Core emits the single approved origin required by the Next.js storefront and Manager.

Set private platform credentials on the `cms.artmatter.co` PHP/WordPress environment. Environment values override values entered through Manager:

```env
AM_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
AM_SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
AM_PUSHOVER_APP_TOKEN=YOUR_PUSHOVER_APP_TOKEN
AM_PUSHOVER_USER_KEY=YOUR_PUSHOVER_USER_KEY
AM_R2_ACCOUNT_ID=YOUR_R2_ACCOUNT_ID
AM_R2_BUCKET=YOUR_PRIVATE_BUCKET
AM_R2_ACCESS_KEY=YOUR_R2_ACCESS_KEY
AM_R2_SECRET_KEY=YOUR_R2_SECRET_KEY
AM_CLOUDFLARE_ZONE_ID=YOUR_ZONE_ID
AM_CLOUDFLARE_API_TOKEN=YOUR_CACHE_PURGE_TOKEN
AM_DRIME_ACCESS_TOKEN=YOUR_DRIME_ACCESS_TOKEN
AM_DRIME_WORKSPACE_ID=YOUR_DRIME_WORKSPACE_ID
AM_DRIME_PARENT_FOLDER_ID=YOUR_DRIME_PARENT_FOLDER_ID
AM_DRIME_ENABLED=true
```

Manager intentionally never reads secret values back from WordPress. A blank secret field showing `Configured in CMS environment` means the credential is active on the CMS and remains hidden by design.

For LiteSpeed hosting without process environment management, add constants directly to `wp-config.php` above `/* That's all, stop editing */`:

```php
define( 'AM_SUPABASE_URL', 'https://YOUR_PROJECT.supabase.co' );
define( 'AM_SUPABASE_SERVICE_ROLE_KEY', 'YOUR_SERVICE_ROLE_KEY' );
define( 'AM_PUSHOVER_APP_TOKEN', 'YOUR_PUSHOVER_APP_TOKEN' );
define( 'AM_PUSHOVER_USER_KEY', 'YOUR_PUSHOVER_USER_KEY' );
define( 'AM_R2_ACCOUNT_ID', 'YOUR_R2_ACCOUNT_ID' );
define( 'AM_R2_BUCKET', 'YOUR_PRIVATE_BUCKET' );
define( 'AM_R2_ACCESS_KEY', 'YOUR_R2_ACCESS_KEY' );
define( 'AM_R2_SECRET_KEY', 'YOUR_R2_SECRET_KEY' );
define( 'AM_CLOUDFLARE_ZONE_ID', 'YOUR_ZONE_ID' );
define( 'AM_CLOUDFLARE_API_TOKEN', 'YOUR_CACHE_PURGE_TOKEN' );
define( 'AM_DRIME_ACCESS_TOKEN', 'YOUR_DRIME_ACCESS_TOKEN' );
define( 'AM_DRIME_WORKSPACE_ID', 'YOUR_DRIME_WORKSPACE_ID' );
define( 'AM_DRIME_PARENT_FOLDER_ID', 'YOUR_DRIME_PARENT_FOLDER_ID' );
define( 'AM_DRIME_ENABLED', true );
```

Do not add secret values to the plugin source or Manager container. Manager settings remain a database-backed fallback when no constant or environment variable exists.

### Step 4: Network & Port Routing
- **Container Port**: `80`
- **Domain**: Bind your custom domain (e.g. `artists-admin.artmatter.co` or `manager.artmatter.co`).
- Enable **Automatic SSL Certificate (Let's Encrypt)** in Dokploy.

### Step 5: Health Check
The Dockerfile includes an internal healthcheck endpoint:
- **Path**: `/healthz`
- **Expected Status**: `200 OK`

Click **Deploy**. Dokploy will pull the latest commit, execute the multi-stage build, and bring the container live!
