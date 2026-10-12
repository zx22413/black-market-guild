import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Online rooms live in the Worker (`npm run server:dev`, port 8787); the dev server forwards to it.
  // The V0.7 page (v07.html) talks to the local V0.7 Worker (`npm run server:dev:v07`, port 8788)
  // through /api-v07, so both rule versions can run side by side during the migration.
  server: {
    proxy: {
      '/api-v07': { target: 'http://localhost:8788', ws: true, rewrite: (path) => path.replace(/^\/api-v07/, '/api') },
      '/api': { target: 'http://localhost:8787', ws: true },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      include: ['src/game/**/*.ts', 'src/bots/**/*.ts', 'src/match/**/*.ts', 'src/proto/**/*.ts', 'src/v07/**/*.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
