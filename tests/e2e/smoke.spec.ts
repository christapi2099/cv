import { expect, test } from '@playwright/test';

/**
 * Phase 4 / G4 browser contract. The `no-js` project runs this same file with
 * JavaScript disabled, so every route assertion here doubles as the JS-off
 * matrix: server-rendered HTML, a populated <main>, and native fragments.
 */

const ROUTES = [
  '/',
  '/work',
  '/work/rolltrackapp',
  '/work/saha-collective',
  '/blog',
  '/series',
  '/series/developer-horror-stories',
  '/series/project-breakdowns',
  '/blog/the-migration-that-went-sideways',
  '/blog/forking-a-scheduler-to-save-4000-a-month',
  '/contact',
  '/cv',
  '/about',
] as const;

const WORK_ANCHORS = ['full-stack', 'stripe-connect', 'livekit', 'performance'] as const;

const CASE_STUDY_FRAGMENTS = [
  ['/work/rolltrackapp', 'the-product'],
  ['/work/rolltrackapp', 'retention-analytics'],
  ['/work/rolltrackapp', 'migration'],
  ['/work/saha-collective', 'provider-portal'],
  ['/work/saha-collective', 'scheduler'],
  ['/work/saha-collective', 'saha-meet'],
] as const;

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

test('every route returns 200 with server-rendered main content', async ({ page }) => {
  for (const route of ROUTES) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);

    const main = page.locator('main#main');
    await expect(main, route).toBeVisible();

    const text = (await main.innerText()).trim();
    expect(text.length, `${route} main text`).toBeGreaterThan(200);
  }
});

test('unknown routes return the 404 page with a 404 status', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.locator('main#main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('drifted out of orbit');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /noindex/i,
  );
});

test('work hub value-prop fragments resolve in the browser', async ({ page }) => {
  for (const anchor of WORK_ANCHORS) {
    await page.goto(`/work#${anchor}`);
    await expect(page.locator(`#${anchor}`), anchor).toBeVisible();
    expect(new URL(page.url()).hash, anchor).toBe(`#${anchor}`);
  }
});

test('case-study chapter fragments resolve in the browser', async ({ page }) => {
  for (const [route, anchor] of CASE_STUDY_FRAGMENTS) {
    await page.goto(`${route}#${anchor}`);
    await expect(page.locator(`#${anchor}`), `${route}#${anchor}`).toBeVisible();
    expect(new URL(page.url()).hash, `${route}#${anchor}`).toBe(`#${anchor}`);
  }
});

test.describe('mobile navigation without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the native details disclosure opens and exposes the nav links', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');

    const details = page.locator('header details').first();
    await expect(details).toBeVisible();
    expect(await details.evaluate((element) => element.hasAttribute('open'))).toBe(false);

    await details.locator('summary').click();
    expect(await details.evaluate((element) => element.hasAttribute('open'))).toBe(true);
    await expect(details.getByRole('link', { name: 'Contact' })).toBeVisible();
    await expect(details.getByRole('link', { name: 'CV' })).toBeVisible();
  });
});
