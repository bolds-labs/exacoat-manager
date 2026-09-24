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
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) {
              return 'vendor-three';
            }
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            return 'vendor-libs';
          }
        },
      },
    },
  },
  server: {
    port: 3005,
    host: true,
    proxy: {
      '/cms': {
        target: process.env.VITE_WORDPRESS_URL || 'https://staging.exacoat.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/cms/, ''),
      },
      '/wp-content': {
        target: process.env.VITE_WORDPRESS_URL || 'https://staging.exacoat.com',
        changeOrigin: true,
        secure: true,
      },
      '/wp-json': {
        target: process.env.VITE_WORDPRESS_URL || 'https://staging.exacoat.com',
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
