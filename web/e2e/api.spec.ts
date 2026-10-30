import { expect, test } from '@playwright/test';
import type { WrapStats } from '@vibewrap/vibe-wrapped/schema';
// The same codec the CLI uses to build links.
import { encodeWrap } from '@vibewrap/vibe-wrapped/link';
import { DEMO_STATS } from '../lib/demo';

const clone = (): WrapStats => JSON.parse(JSON.stringify(DEMO_STATS));
const pngSize = (b: Buffer) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) });
const linkFor = (s: WrapStats) => `/w/${encodeWrap(s)}`;

test('a wrap link renders the wrap, its preview card and story image with nothing stored', async ({ page, request }) => {
  const s = clone();
  s.displayName = 'Grace';
  const link = linkFor(s);
  expect(link.length).toBeLessThan(2600);

  await page.goto(`${link}?autoplay=0`);
  await expect(page.getByText('Hey Grace.')).toBeVisible();
  await expect(page).toHaveTitle(/Grace’s 2026 Vibe Wrapped/);
  const og = await page.locator('meta[property="og:image"]').first().getAttribute('content');
  expect(og).toContain(`${link}/opengraph-image`);

  const card = await request.get(`${link}/opengraph-image`);
  expect(card.headers()['content-type']).toBe('image/png');
  expect(pngSize(await card.body())).toEqual({ width: 1200, height: 630 });
  const story = await request.get(`${link}/story`);
  expect(story.headers()['content-disposition']).toContain('attachment');
  expect(pngSize(await story.body())).toEqual({ width: 1080, height: 1920 });
});

test('broken, tampered or invalid links show the 404 page, never an error', async ({ page, request }) => {
  const good = encodeWrap(clone());
  const bad = { ...clone(), persona: { id: 'hacker' } };
  const badDate = clone();
  badDate.coverage.firstDay = '2026-99-99';
  for (const code of ['AAAAAAAAAA', '1garbage', good.slice(0, -12), '2' + good.slice(1), '1' + 'A'.repeat(9000), encodeWrap(bad), encodeWrap(badDate)]) {
    const res = await page.goto(`/w/${code}`);
    expect(res!.status(), code.slice(0, 16)).toBe(404);
    await expect(page.getByRole('heading', { name: 'This wrap has been unwrapped.' })).toBeVisible();
    expect((await request.get(`/w/${code}/story`)).status()).toBe(404);
    expect((await request.get(`/w/${code}/opengraph-image`)).status()).toBe(404);
  }
});

test('there is no storage API anymore', async ({ request }) => {
  for (const [method, path] of [['post', '/api/wraps'], ['get', '/api/wraps/AAAAAAAAAA'], ['delete', '/api/wraps/AAAAAAAAAA']] as const) {
    const res = await request[method](path, method === 'post' ? { data: clone() } : {});
    expect(res.status(), `${method} ${path}`).toBeGreaterThanOrEqual(400);
    expect(res.status()).not.toBe(500);
  }
});

test('thin data: empty-looking slides are skipped and coverage is honest', async ({ page }) => {
  const s = clone();
  s.displayName = null;
  s.coverage = { firstDay: '2026-10-30', lastDay: '2026-10-30', activeDays: 1, spanDays: 1 };
  s.totals = { sessions: 2, prompts: 6, activeMinutes: 25, toolCalls: 8, tokens: { total: 0, input: 0, output: 0, cached: 0 } };
  s.tools = [{ id: 'cursor', sessions: 2, prompts: 6, activeMinutes: 25, share: 1, hasTokens: false, tokens: { total: 0, input: 0, output: 0, cached: 0 } }];
  s.models = [{ name: 'grok-4.6', tool: 'cursor', turns: 9, share: 1 }];
  s.projects = { hidden: true, count: 1, top: [{ name: 'Project 1', activeMinutes: 25, sessions: 2 }] };
  s.rhythm = { ...s.rhythm, days: [{ d: '2026-10-30', m: 25 }], busiestDay: { date: '2026-10-30', minutes: 25 } };
  s.marathons = { longestSession: { minutes: 18, tool: 'cursor', date: '2026-10-30' }, longestStreak: { days: 1, from: '2026-10-30', to: '2026-10-30' }, avgSessionMinutes: 12, longSessionShare: 0, shortSessionShare: 1 };
  s.agent = { totalCalls: 8, shellCommands: 5, fileEdits: 2, fileReads: 1, searches: 0, webCalls: 0, top: [{ category: 'shell', count: 5 }] };
  s.persona = { id: 'sprint-coder' };

  await page.goto(`${linkFor(s)}?autoplay=0`);
  await expect(page.getByText('Based on 1 active day of history')).toBeVisible();
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    seen.push((await page.locator('section.story').getAttribute('data-slide'))!);
    if (seen.at(-1) === 'summary') break;
    await page.keyboard.press('ArrowRight');
  }
  expect(seen).toEqual(['intro', 'numbers', 'tools', 'models', 'projects', 'persona', 'summary']);
  await expect(page.locator('.progress-track')).toHaveCount(7);
});
