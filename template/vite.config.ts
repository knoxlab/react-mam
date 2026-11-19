import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5174,
    strictPort: false,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/media-play': { target: 'http://localhost:8080', changeOrigin: true },
      '/media-stream': { target: 'http://localhost:8080', changeOrigin: true },
      '/media-preview': { target: 'http://localhost:8080', changeOrigin: true },
      '/media-thumb': { target: 'http://localhost:8080', changeOrigin: true },
      '/media-file': { target: 'http://localhost:8080', changeOrigin: true }
    }
  }
});
