process.env.TZ = 'UTC';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectSessions } from '../src/parsers/index.js';
import { PERSONA_IDS, pickPersona } from '../src/personas.js';
import { MAX_PAYLOAD_BYTES, validateWrap } from '../src/schema.js';
import { computeWrap, resolveRange } from '../src/stats.js';
import { SECRET_PROMPT, makeFixtureHome } from './fixtures.js';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const home = await makeFixtureHome();
const { sessions } = await collectSessions({ home, env: { PATH: process.env.PATH }, platform: 'linux' });
const year = resolveRange({ kind: 'year', now: NOW });
const wrap = computeWrap(sessions, { range: year });

test('totals across all three tools', () => {
  assert.equal(wrap.totals.sessions, 3, 'subagent session not counted');
  assert.equal(wrap.totals.prompts, 5);
  assert.equal(wrap.totals.activeMinutes, 28, '20m claude (idle gaps dropped) + ~5m codex + 3m cursor');
  assert.equal(wrap.totals.toolCalls, 7);
  assert.deepEqual(wrap.totals.tokens, { total: 30 + 100 + 3300 + 10 + 7 + 1100 + 400 + 100 + 600, input: 440, output: 207, cached: 5000 });
});

test('per-tool split, models and projects', () => {
  assert.deepEqual(
    wrap.tools.map((t) => t.id),
    ['claude-code', 'codex', 'cursor'],
  );
  const share = wrap.tools.reduce((s, t) => s + t.share, 0);
  assert.ok(Math.abs(share - 1) < 0.001);
  assert.equal(wrap.tools.find((t) => t.id === 'cursor').hasTokens, false);
  assert.equal(wrap.tools.find((t) => t.id === 'codex').hasTokens, true);
  assert.equal(wrap.models[0].name, 'claude-opus-5-5');
  assert.deepEqual(
    wrap.models.map((m) => m.name).sort(),
    ['claude-haiku-5-5', 'claude-opus-5-5', 'gpt-6.1-sol', 'grok-4.6'],
  );
  assert.deepEqual(
    wrap.projects.top.map((p) => p.name),
    ['alpha-secret', 'beta', 'gamma'],
  );
  assert.equal(wrap.projects.count, 3);
});

test('rhythm, marathons, agent, roast', () => {
  assert.equal(wrap.rhythm.byHour[22], 20);
  assert.equal(wrap.rhythm.busiestHour, 22);
  assert.equal(wrap.rhythm.busiestDay.date, '2026-03-02');
  assert.deepEqual(
    wrap.rhythm.days.map((d) => d.d),
    ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'],
  );
  assert.ok(wrap.rhythm.nightShare > 0.7);
  assert.deepEqual(wrap.marathons.longestStreak, { days: 4, from: '2026-03-02', to: '2026-03-05' });
  assert.equal(wrap.marathons.longestSession.tool, 'claude-code');
  assert.equal(wrap.marathons.longestSession.minutes, 20);
  assert.equal(wrap.agent.shellCommands, 3);
  assert.equal(wrap.agent.fileEdits, 2);
  assert.equal(wrap.agent.searches, 1);
  assert.equal(wrap.agent.top[0].category, 'shell');
  assert.equal(wrap.roast.please, 3);
  assert.equal(wrap.roast.thanks, 2);
  assert.equal(wrap.roast.stillBroken, 1);
  assert.equal(wrap.roast.why, 1);
  assert.equal(wrap.roast.youreRight, 1);
  assert.equal(wrap.roast.longestPromptChars, SECRET_PROMPT.length);
  assert.equal(wrap.coverage.activeDays, 4);
  assert.equal(wrap.coverage.spanDays, 4);
  assert.ok(PERSONA_IDS.includes(wrap.persona.id));
});

test('range filtering: year default, all, custom', () => {
  const last = computeWrap(sessions, { range: resolveRange({ kind: 'year', now: Date.parse('2025-06-01T00:00:00Z') }) });
  assert.equal(last.totals.sessions, 0, '2025 has no activity');
  assert.equal(last.range.label, '2025');
  const all = computeWrap(sessions, { range: resolveRange({ kind: 'all' }) });
  assert.equal(all.totals.prompts, 5);
  assert.equal(all.range.label, 'All time');
  const custom = computeWrap(sessions, { range: resolveRange({ kind: 'custom', since: '2026-03-04', until: '2026-03-04', now: NOW }) });
  assert.deepEqual(
    custom.tools.map((t) => t.id),
    ['codex'],
  );
  assert.throws(() => resolveRange({ kind: 'custom', since: '2026-13-01' }), /Invalid --since/);
  assert.throws(() => resolveRange({ kind: 'custom', since: '2026-05-01', until: '2026-04-01' }), /on or before/);
  assert.throws(() => resolveRange({ kind: 'decade' }), /Unknown range/);
});

test('payload is valid, small, and carries no prompt text or paths', () => {
  const v = validateWrap(wrap);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const json = JSON.stringify(wrap);
  assert.ok(json.length < MAX_PAYLOAD_BYTES);
  for (const leak of ['SuperSecretBillingEngine', 'refactor', '/home/u', 'make the button blue', 'add tests', 'subagent task text'])
    assert.ok(!json.includes(leak), `payload leaks "${leak}"`);
});

test('hidden projects become Project 1-5', () => {
  const hidden = computeWrap(sessions, { range: year, hideProjects: true });
  assert.deepEqual(
    hidden.projects.top.map((p) => p.name),
    ['Project 1', 'Project 2', 'Project 3'],
  );
  assert.equal(hidden.projects.hidden, true);
  assert.ok(!JSON.stringify(hidden).includes('alpha-secret'));
});

test('display name is cleaned to plain text', () => {
  const w = computeWrap(sessions, { range: year, displayName: '<script>alert(1)</script> Seb' });
  assert.equal(w.displayName, 'scriptalert(1)/script Seb');
  assert.equal(validateWrap(w).ok, true);
});

test('validator rejects bad input and strips unknown fields', () => {
  assert.equal(validateWrap(null).ok, false);
  assert.equal(validateWrap({ ...wrap, persona: { id: 'hacker' } }).ok, false);
  assert.equal(validateWrap({ ...wrap, displayName: '<b>x</b>' }).ok, false);
  assert.equal(validateWrap({ ...wrap, totals: { ...wrap.totals, prompts: -1 } }).ok, false);
  assert.equal(validateWrap({ ...wrap, padding: 'x'.repeat(MAX_PAYLOAD_BYTES) }).ok, false);
  const v = validateWrap({ ...wrap, prompts: ['leak'], totals: { ...wrap.totals, extra: 1 } });
  assert.equal(v.ok, true);
  assert.equal(v.value.prompts, undefined);
  assert.equal(v.value.totals.extra, undefined);
});

// --- personas -------------------------------------------------------------
const H = 3600_000;
function session(tool, startIso, { n = 10, stepMin = 5, project = 'p', prompt = 'do it', toolName = 'Bash', tokens = null, model = 'm' } = {}) {
  const start = Date.parse(startIso);
  const events = [];
  for (let i = 0; i < n; i++) {
    const ts = start + i * stepMin * 60_000;
    events.push(i % 3 === 0 ? { ts, kind: 'prompt', text: prompt } : i % 3 === 1 ? { ts, kind: 'assistant', model } : { ts, kind: 'tool', toolName });
  }
  return { tool, id: `${tool}-${startIso}`, project, isSubagent: false, events, tokens };
}
const personaOf = (ss) => computeWrap(ss, { range: resolveRange({ kind: 'all' }) }).persona.id;

test('persona: night owl vs early bird', () => {
  assert.equal(personaOf([session('codex', '2026-03-01T23:00:00Z', { toolName: 'Read' }), session('codex', '2026-03-02T23:30:00Z', { toolName: 'Read' })]), 'midnight-architect');
  assert.equal(personaOf([session('codex', '2026-03-01T06:00:00Z', { toolName: 'Read' }), session('codex', '2026-03-02T06:30:00Z', { toolName: 'Read' })]), 'dawn-shipper');
});

test('persona: marathon, tool hopper, polite, token whale, juggler, shell', () => {
  assert.equal(personaOf([session('claude-code', '2026-03-01T13:00:00Z', { n: 60, stepMin: 4, toolName: 'Read' })]), 'marathon-prompter');
  assert.equal(
    personaOf([
      session('claude-code', '2026-03-01T13:00:00Z', { toolName: 'Read' }),
      session('codex', '2026-03-02T13:00:00Z', { toolName: 'Read' }),
      session('cursor', '2026-03-03T13:00:00Z', { toolName: 'Read' }),
    ]),
    'tool-hopper',
  );
  assert.equal(personaOf([session('codex', '2026-03-01T13:00:00Z', { n: 40, stepMin: 2, prompt: 'please, thank you', toolName: 'Read' })]), 'polite-one');
  assert.equal(personaOf([session('codex', '2026-03-01T13:00:00Z', { tokens: { input: 1, output: 1, cached: 40_000_000 }, toolName: 'Read' })]), 'token-whale');
  assert.equal(
    personaOf(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((p, i) => session('codex', `2026-03-${String(i + 1).padStart(2, '0')}T13:00:00Z`, { project: p, toolName: 'Read', n: 4 }))),
    'project-juggler',
  );
  assert.equal(personaOf([session('codex', '2026-03-01T13:00:00Z', { n: 90, stepMin: 1 })]), 'shell-commander');
});

test('persona: always one of the ten, even with no data', () => {
  const empty = computeWrap([], { range: resolveRange({ kind: 'all' }) });
  assert.ok(PERSONA_IDS.includes(empty.persona.id));
  assert.equal(validateWrap(empty).ok, true);
  assert.equal(PERSONA_IDS.length, 10);
  assert.equal(typeof pickPersona(empty).scores, 'object');
});
