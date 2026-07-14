import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('aws-amplify') || id.includes('@aws-amplify')) return 'amplify';
          if (id.includes('react') || id.includes('scheduler')) return 'react';
        },
      },
    },
  },
  server: {
    port: 5181,
    open: true
  }
})
