/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_WORDPRESS_URL?: string;
  readonly VITE_WC_CONSUMER_KEY?: string;
  readonly VITE_WC_CONSUMER_SECRET?: string;
  readonly VITE_ADMIN_EMAIL?: string;
  readonly VITE_N8N_WEBHOOK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
