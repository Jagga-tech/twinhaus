import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // Three.js is legitimately ~1MB; it lives in its own vendor chunk, so raise the advisory
    // limit above it rather than chasing a warning we can't remove without lazy-loading 3D.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        // Keep the heavy 3D stack in its own long-cached vendor chunk, separate from app code.
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
