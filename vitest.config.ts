import { defineConfig } from 'vitest/config';

// Pure-logic tests run in Node; anything touching the DOM is kept out of these suites.
// Vitest uses Vite's resolver, so the `.js`-suffixed imports on `.ts` source resolve the
// same way they do in the app build.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
  },
});
