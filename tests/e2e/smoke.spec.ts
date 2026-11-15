import { expect, test } from '@playwright/test';

test('serves the shell with the server-rendered dark theme', async ({ page, request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);

  // The server response is the no-JS path and must always be dark (D2);
  // a light-preferring browser is allowed to remove the class after paint.
  expect(await response.text()).toMatch(/<html[^>]*class="dark"/);

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Christopher Tapia');
  await expect(page.locator('main#main')).toBeVisible();
});
