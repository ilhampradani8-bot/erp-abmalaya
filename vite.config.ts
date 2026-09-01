import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './resources/js'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '^/api_.*': 'http://127.0.0.1:8000',
      '/import_products.php': 'http://127.0.0.1:8000'
    }
  }
});
