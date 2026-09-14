import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

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
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jspdf')) return 'vendor-pdf';
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            return 'vendor-core';
          }
        },
      },
    },
  },
  server: {
    port: 3025,
    host: true,
    proxy: {
      '/cms': {
        target: 'https://exacoat.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/cms/, ''),
      },
    },
  },
  preview: {
    port: 3025,
    host: true,
  },
});
