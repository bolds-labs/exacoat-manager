import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'esnext',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Only React gets a fixed shared chunk. Every other library is left to automatic
        // splitting so it loads with the screen that imports it (a catch-all vendor chunk
        // forced PDF, chart and email libraries onto the login and orders screens).
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return 'vendor-react';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 3005,
    host: true,
    proxy: {
      '/cms': {
        target: process.env.VITE_WORDPRESS_URL || 'https://cms.exacoat.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/cms/, ''),
      },
      '/wp-content': {
        target: process.env.VITE_WORDPRESS_URL || 'https://cms.exacoat.com',
        changeOrigin: true,
        secure: true,
      },
      '/wp-json': {
        target: process.env.VITE_WORDPRESS_URL || 'https://cms.exacoat.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  preview: {
    port: 3005,
    host: true,
  },
});
