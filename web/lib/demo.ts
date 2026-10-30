// The sample wrap behind "See a demo": a believable year of vibe coding, generated deterministically.
import type { WrapStats } from '@vibewrap/vibe-wrapped/schema';

export const DEMO_ID = 'demo';

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ACTIVE_MINUTES = 31_260;
const iso = (d: Date) => d.toISOString().slice(0, 10);

function demoDays() {
  const rand = rng(2026);
  const days: { d: string; m: number }[] = [];
  const start = Date.UTC(2026, 0, 6);
  const end = Date.UTC(2026, 9, 28);
  for (let t = start; t <= end; t += 86_400_000) {
    const date = new Date(t);
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const inStreak = t >= Date.UTC(2026, 3, 2) && t <= Date.UTC(2026, 3, 24);
    const active = t === start || t === end || inStreak || rand() < (weekend ? 0.45 : 0.72);
    if (active) days.push({ d: iso(date), m: 20 + Math.round(rand() ** 2 * 300) });
  }
  // Scale to the advertised total, with one memorable day.
  const sum = days.reduce((s, x) => s + x.m, 0);
  for (const x of days) x.m = Math.max(5, Math.round((x.m / sum) * (ACTIVE_MINUTES - 640)));
  const big = days.find((x) => x.d === '2026-07-18');
  if (big) big.m = Math.min(1440, big.m + 640);
  return days;
}

const days = demoDays();
const busiest = days.reduce((b, x) => (x.m > b.m ? x : b), days[0]);

export const DEMO_STATS: WrapStats = {
  schemaVersion: 1,
  generator: 'vibe-wrapped@0.1.0',
  displayName: 'Ada',
  range: { kind: 'year', label: '2026', from: '2026-01-01', to: '2026-12-31' },
  coverage: { firstDay: days[0].d, lastDay: days[days.length - 1].d, activeDays: days.length, spanDays: 296 },
  totals: {
    sessions: 1184,
    prompts: 9642,
    activeMinutes: ACTIVE_MINUTES,
    toolCalls: 48_210,
    tokens: { total: 1_842_300_000, input: 21_400_000, output: 38_900_000, cached: 1_782_000_000 },
  },
  tools: [
    { id: 'claude-code', sessions: 688, prompts: 5590, activeMinutes: 18_131, share: 0.58, hasTokens: true, tokens: { total: 1_268_000_000, input: 12_100_000, output: 25_900_000, cached: 1_230_000_000 } },
    { id: 'codex', sessions: 331, prompts: 2797, activeMinutes: 9065, share: 0.29, hasTokens: true, tokens: { total: 574_300_000, input: 9_300_000, output: 13_000_000, cached: 552_000_000 } },
    { id: 'cursor', sessions: 165, prompts: 1255, activeMinutes: 4064, share: 0.13, hasTokens: false, tokens: { total: 0, input: 0, output: 0, cached: 0 } },
  ],
  models: [
    { name: 'claude-opus-5-5', tool: 'claude-code', turns: 21_450, share: 0.46 },
    { name: 'claude-sonnet-5-5', tool: 'claude-code', turns: 9790, share: 0.21 },
    { name: 'gpt-6.1-sol', tool: 'codex', turns: 7930, share: 0.17 },
    { name: 'gpt-6-luna', tool: 'codex', turns: 4200, share: 0.09 },
    { name: 'grok-4.6', tool: 'cursor', turns: 3260, share: 0.07 },
  ],
  projects: {
    hidden: false,
    count: 23,
    top: [
      { name: 'orbit-dashboard', activeMinutes: 9120, sessions: 302 },
      { name: 'tiny-compiler', activeMinutes: 6480, sessions: 211 },
      { name: 'recipe-ai', activeMinutes: 4310, sessions: 166 },
      { name: 'dotfiles', activeMinutes: 1980, sessions: 140 },
      { name: 'landing-v3', activeMinutes: 1650, sessions: 58 },
    ],
  },
  rhythm: {
    byHour: [2110, 1430, 760, 240, 60, 20, 30, 110, 420, 980, 1340, 1460, 1120, 1390, 1620, 1710, 1580, 1290, 1050, 1340, 2010, 2620, 3140, 3390],
    byWeekday: [5120, 5480, 5010, 5360, 4290, 3170, 2830],
    days,
    busiestHour: 23,
    busiestWeekday: 1,
    busiestDay: { date: busiest.d, minutes: busiest.m },
    nightShare: 0.41,
    morningShare: 0.02,
  },
  marathons: {
    longestSession: { minutes: 412, tool: 'claude-code', date: '2026-07-18' },
    longestStreak: { days: 23, from: '2026-04-02', to: '2026-04-24' },
    avgSessionMinutes: 26,
    longSessionShare: 0.18,
    shortSessionShare: 0.44,
  },
  agent: {
    totalCalls: 48_210,
    shellCommands: 19_870,
    fileEdits: 11_240,
    fileReads: 9830,
    searches: 4120,
    webCalls: 1310,
    top: [
      { category: 'shell', count: 19_870 },
      { category: 'edit', count: 11_240 },
      { category: 'read', count: 9830 },
      { category: 'search', count: 4120 },
      { category: 'web', count: 1310 },
      { category: 'agent', count: 980 },
      { category: 'mcp', count: 610 },
      { category: 'plan', count: 250 },
    ],
  },
  roast: { please: 1204, thanks: 873, stillBroken: 96, why: 341, youreRight: 312, sorry: 41, longestPromptChars: 6240, avgPromptChars: 184 },
  persona: { id: 'midnight-architect' },
};
