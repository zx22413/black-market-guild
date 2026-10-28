import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // The game, and the private /stats dashboard (src/stats, docs/online/public-launch-plan.md §4.4).
  build: {
    rollupOptions: {
      input: { main: 'index.html', stats: 'stats.html' },
    },
  },
  // Online rooms live in the Worker (`npm run server:dev`, port 8787); the dev server forwards to it.
  server: {
    proxy: {
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
