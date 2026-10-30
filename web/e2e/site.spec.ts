import { expect, test, type Page } from '@playwright/test';
import { SLIDE_ORDER } from '../lib/slides';

const pngSize = (b: Buffer) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) });
const slideId = (page: Page) => page.locator('section.story').getAttribute('data-slide');

test('homepage: hero, copyable command, demo link, privacy payload, tools', async ({ page, context }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your year of vibe coding, wrapped.');
  await expect(page.locator('.hero .command code')).toContainText('npx @vibewrap/vibe-wrapped');

  if (info.project.name === 'desktop') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('.hero .command button').click();
    await expect(page.locator('.hero .command button')).toHaveText('Copied!');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npx @vibewrap/vibe-wrapped');
  }

  const payload = page.locator('pre.payload');
  await expect(payload).toContainText('"schemaVersion": 1');
  await expect(payload).toContainText('"persona"');
  await expect(page.getByText('Your prompts never leave your laptop.')).toBeVisible();
  for (const name of ['Claude Code', 'Codex', 'Cursor']) await expect(page.locator('.tool-card h3', { hasText: name })).toBeVisible();
  await expect(page.locator('.hero-nav a', { hasText: 'GitHub' })).toHaveAttribute('href', 'https://github.com/Barosinec/Vibe-Coding-Wrapped');
  await expect(page.locator('footer a', { hasText: 'GitHub' })).toHaveAttribute('href', 'https://github.com/Barosinec/Vibe-Coding-Wrapped');

  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(info.project.use.viewport!.width);

  await page.locator('.hero-ctas').getByRole('link', { name: 'See a demo' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.locator('section.story')).toHaveAttribute('data-slide', 'intro');
});

test('demo: all 12 slides in order with keyboard, and back', async ({ page }) => {
  await page.goto('/demo?autoplay=0');
  const seen = [await slideId(page)];
  for (let i = 0; i < 11; i++) {
    await page.keyboard.press('ArrowRight');
    seen.push(await slideId(page));
  }
  expect(seen).toEqual([...SLIDE_ORDER]);
  await expect(page.locator('.progress-track')).toHaveCount(12);
  await page.keyboard.press('ArrowRight'); // stays on the last slide
  await expect(page.locator('section.story')).toHaveAttribute('data-slide', 'summary');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('section.story')).toHaveAttribute('data-slide', 'persona');
  await page.keyboard.press('Home');
  await expect(page.locator('section.story')).toHaveAttribute('data-slide', 'intro');
  // Tool names only, no logos or images anywhere in the story.
  await expect(page.locator('section.story img')).toHaveCount(0);
});

test('demo: tap right advances, tap left goes back, swipe works', async ({ page }) => {
  await page.goto('/demo?autoplay=0');
  const story = page.locator('section.story');
  const box = (await story.boundingBox())!;
  const y = box.y + box.height * 0.5;
  await page.mouse.click(box.x + box.width * 0.85, y);
  await expect(story).toHaveAttribute('data-slide', 'numbers');
  await page.mouse.click(box.x + box.width * 0.85, y);
  await expect(story).toHaveAttribute('data-slide', 'tools');
  await page.mouse.click(box.x + box.width * 0.1, y);
  await expect(story).toHaveAttribute('data-slide', 'numbers');

  const swipe = async (from: number, to: number) => {
    await page.mouse.move(box.x + box.width * from, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * ((from + to) / 2), y, { steps: 4 });
    await page.mouse.move(box.x + box.width * to, y, { steps: 4 });
    await page.mouse.up();
  };
  await swipe(0.8, 0.2); // swipe left = next
  await expect(story).toHaveAttribute('data-slide', 'tools');
  await swipe(0.2, 0.8); // swipe right = previous
  await expect(story).toHaveAttribute('data-slide', 'numbers');
  await page.getByRole('button', { name: 'Next slide' }).click();
  await expect(story).toHaveAttribute('data-slide', 'tools');
});

test('demo: layout fits the viewport and shows a 9:16 frame on desktop', async ({ page }, info) => {
  await page.goto('/demo?autoplay=0&slide=3');
  const box = (await page.locator('section.story').boundingBox())!;
  const vp = info.project.use.viewport!;
  if (info.project.name === 'mobile') {
    expect(Math.round(box.width)).toBe(vp.width);
    expect(Math.round(box.height)).toBe(vp.height);
  } else {
    expect(box.height).toBeLessThanOrEqual(vp.height);
    expect(Math.abs(box.width / box.height - 9 / 16)).toBeLessThan(0.01);
  }
  // Tool names are present by name with their colours.
  await expect(page.locator('.bars .tool-name')).toHaveText(['Claude Code', 'Codex', 'Cursor']);
});

test('demo: autoplay advances by itself', async ({ page }) => {
  test.slow();
  await page.goto('/demo');
  await expect(page.locator('section.story')).toHaveAttribute('data-slide', 'intro');
  await expect(page.locator('section.story')).toHaveAttribute('data-slide', 'numbers', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForTimeout(8000);
  await expect(page.locator('section.story')).toHaveAttribute('data-slide', 'numbers');
});

test('summary: download button saves a 1080x1920 story PNG', async ({ page }) => {
  await page.goto('/demo?autoplay=0&slide=12');
  await expect(page.locator('section.story')).toHaveAttribute('data-slide', 'summary');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download story image' }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  expect(pngSize(await readFile(path!))).toEqual({ width: 1080, height: 1920 });
  // Navigation buttons on the summary don't advance or reset the story.
  await expect(page.locator('section.story')).toHaveAttribute('data-slide', 'summary');
});

test('demo and wrap pages expose a 1200x630 preview image', async ({ page, request }) => {
  await page.goto('/demo');
  const og = await page.locator('meta[property="og:image"]').first().getAttribute('content');
  expect(og).toContain('/w/demo/opengraph-image');
  const res = await request.get(og!);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
  expect(pngSize(await res.body())).toEqual({ width: 1200, height: 630 });
});

test('unknown wrap shows the 404 page', async ({ page }) => {
  const res = await page.goto('/w/AAAAAAAAAA');
  expect(res!.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This wrap has been unwrapped.' })).toBeVisible();
});

test('autoplay: the final slide gets its own progress segment', async ({ page }) => {
  await page.goto('/demo?slide=12');
  await expect(page.locator('section.story')).toHaveAttribute('data-slide', 'summary');
  const fills = page.locator('.progress-fill');
  await expect(fills.last()).toHaveAttribute('data-state', 'running');
  await expect(fills.nth(10)).toHaveAttribute('data-state', 'done');
});

test('privacy and terms pages are linked from the footer and readable', async ({ page }, info) => {
  await page.goto('/');
  await page.locator('footer').getByRole('link', { name: 'Privacy' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy');
  await expect(page.getByText('no cookies, no analytics and no trackers')).toBeVisible();
  await expect(page.getByRole('link', { name: 'GitHub' }).first()).toHaveAttribute('href', /Vibe-Coding-Wrapped\/issues/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(info.project.use.viewport!.width);
  await page.getByRole('link', { name: 'Terms' }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Terms');
  await expect(page.getByText('provided “as is”')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(info.project.use.viewport!.width);
});
