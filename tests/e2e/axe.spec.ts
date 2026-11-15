import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('shell has zero serious or critical axe violations', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );

  expect(serious).toEqual([]);
});
