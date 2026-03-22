import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  optimizeDeps: {
    include: ['recharts', 'react-is'],
  },
  server: {
    proxy: {
      // Forward /.netlify/functions/* to the Netlify Functions server
      // Run: netlify functions:serve  (starts on port 9999 by default)
      // Then: npm run dev  (starts Vite on port 5173)
      '/.netlify/functions': {
        target: 'http://localhost:9999',
        changeOrigin: true,
      },
    },
  },
});
