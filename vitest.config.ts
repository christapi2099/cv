import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /* Unit tests only: Playwright specs live in tests/e2e and run under
       `playwright test`. */
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
