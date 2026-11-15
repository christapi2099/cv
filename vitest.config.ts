import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const threeStub = fileURLToPath(new URL('./tests/vendor/three-stub.js', import.meta.url));

export default defineConfig({
  test: {
    passWithNoTests: true,
    /* Two projects so the `three` stub is scoped to the vendored fixture and
       can never leak into app/unit tests (D6, plan §3). */
    projects: [
      {
        test: {
          name: 'unit',
          /* Unit tests only: Playwright specs live in tests/e2e and run under
             `playwright test`. */
          include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: {
          alias: {
            three: threeStub,
          },
        },
        test: {
          name: 'vendor',
          include: ['tests/vendor/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
