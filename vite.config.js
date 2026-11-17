import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import legacy from '@vitejs/plugin-legacy';
import viteCompression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';

// In development and preview, send /api to the local API server
// (`npm run dev:api`). In production Netlify serves /api itself.
const apiProxy = { "/api": `http://localhost:${process.env.API_PORT || 8788}` };

export default defineConfig(({ mode }) => ({
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      targets: ['defaults', 'not IE 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
    viteCompression(),
    // Bundle report is opt-in: `npm run analyze` (vite build --mode analyze).
    // A normal build must not open a browser tab or write stats.html.
    ...(mode === 'analyze'
      ? [
          visualizer({
            open: true,
            filename: 'stats.html',
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  build: {
    sourcemap: false,
  },
}));
