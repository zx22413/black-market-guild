import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Online rooms live in the Worker (`npm run server:dev`, port 8787); the dev server forwards to it.
  server: { proxy: { '/api': { target: 'http://localhost:8787', ws: true } } },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      include: ['src/game/**/*.ts', 'src/bots/**/*.ts', 'src/match/**/*.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
