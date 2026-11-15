import { expect, test } from '@playwright/test';

/**
 * Phase 3 browser slice (G3): the vendored element is bundled + upgraded, the
 * intro runs once, the sound control is above the overlay, and every
 * degraded path leaves a usable page behind.
 *
 * Deeper audio timing (fades, autoplay rejection, watchdog) lives in
 * `scripts/check-audio.mjs`, which instruments the WebAudio graph.
 */

test.use({
  colorScheme: 'dark',
  launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
});

const introPlaying = (page: import('@playwright/test').Page) =>
  page.waitForFunction(
    () => document.querySelector('wormhole-bg')?.getAttribute('data-intro') === 'playing',
    null,
    { timeout: 25000 },
  );

test('plays the intro once, is Esc-skippable, and releases the shell', async ({ page }) => {
  await page.goto('/');
  await introPlaying(page);

  const shell = page.locator('[data-wormhole-shell]');
  expect(await shell.evaluate((node) => node.hasAttribute('inert'))).toBe(true);
  await expect(page.locator('#sound-toggle')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect
    .poll(() => page.evaluate(() => document.querySelector('wormhole-bg')?.getAttribute('data-intro')))
    .toBeNull();
  expect(await shell.evaluate((node) => node.hasAttribute('inert'))).toBe(false);
  await expect(page.locator('main#main')).toBeVisible();
});

test('the sound control sits above the overlay and Tab to it keeps the intro alive', async ({ page }) => {
  await page.goto('/');
  await introPlaying(page);

  const control = page.locator('[data-sound-cluster]');
  await expect(control).toHaveAttribute('data-intro-control', '');
  const zIndex = await control.evaluate((node) => getComputedStyle(node).zIndex);
  expect(Number(zIndex)).toBeGreaterThan(2_147_483_000);

  // The vendor focuses Skip; one Tab lands on the marked site control.
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('sound-toggle');
  expect(
    await page.evaluate(() => document.querySelector('wormhole-bg')?.getAttribute('data-intro')),
  ).toBe('playing');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('never imports the effect and shows the static site fallback', async ({ page }) => {
    await page.goto('/');
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.dataset.wormholeFallback ?? null),
      )
      .toBe('reduced-motion');
    expect(await page.evaluate(() => Boolean(customElements.get('wormhole-bg')))).toBe(false);
    expect(
      await page.evaluate(() => document.querySelector('wormhole-bg')?.getAttribute('data-intro')),
    ).toBeNull();
    await expect(page.locator('[data-sound-cluster]')).toBeHidden();
  });
});

test('no WebGL 2: no intro, site-level storm gradient fallback', async ({ page }) => {
  await page.addInitScript(`
    (() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, ...rest) {
        if (type === 'webgl2' || type === 'webgl') return null;
        return original.call(this, type, ...rest);
      };
    })();
  `);
  await page.goto('/');

  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.wormholeFallback ?? null))
    .toBe('webgl');
  expect(
    await page.evaluate(() => document.querySelector('wormhole-bg')?.getAttribute('data-intro')),
  ).toBeNull();
  const gradient = await page.evaluate(
    () => getComputedStyle(document.body, '::before').backgroundImage,
  );
  expect(gradient).toContain('radial-gradient');
  await expect(page.locator('[data-sound-cluster]')).toBeHidden();
});

test('a failed local chunk releases the shell and keeps the page usable', async ({ page }) => {
  await page.route(/element\..*\.js/, (route) => route.abort());
  await page.goto('/');

  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.wormholeFallback ?? null))
    .toBe('import-failed');
  expect(
    await page.evaluate(
      () => document.querySelector('[data-wormhole-shell]')?.hasAttribute('inert') ?? null,
    ),
  ).toBe(false);
  await expect(page.locator('main#main')).toBeVisible();
});
