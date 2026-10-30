process.env.TZ = 'UTC';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { main, parseArgs } from '../src/cli.js';
import { validateWrap } from '../src/schema.js';
import { fixtureEnv, makeFixtureHome } from './fixtures.js';

const BIN = fileURLToPath(new URL('../bin/vibe-wrapped.js', import.meta.url));
const NOW = Date.parse('2026-10-30T12:00:00Z');
const home = await makeFixtureHome();

function sink() {
  let text = '';
  const s = new Writable({ write(chunk, _enc, cb) { text += chunk; cb(); } });
  return { stream: s, get text() { return text; } };
}

async function run(argv, { answers = null, home: h = home, env = {} } = {}) {
  const out = sink();
  const err = sink();
  const stdin = new PassThrough();
  if (answers) stdin.end(answers.map((a) => a + '\n').join(''));
  else stdin.end();
  const code = await main(argv, {
    stdin, stdout: out.stream, stderr: err.stream, home: h, env: { ...fixtureEnv(h), ...env },
    platform: 'linux', now: NOW, interactive: Boolean(answers), color: false,
  });
  return { code, stdout: out.text, stderr: err.text };
}

test('--dry-run --yes prints summary + valid JSON and never touches the network', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls++; throw new Error('network used'); };
  try {
    const r = await run(['--dry-run', '--yes']);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stderr, /Vibe Wrapped — 2026/);
    assert.match(r.stderr, /Based on 4 active days of history \(Mar 2 – Mar 5\)/);
    assert.match(r.stderr, /Claude Code ✓ {3}Codex ✓ {3}Cursor ✓/);
    assert.match(r.stderr, /Nothing was sent/);
    const wrap = JSON.parse(r.stdout);
    assert.equal(validateWrap(wrap).ok, true);
    assert.equal(wrap.range.kind, 'year');
    assert.equal(wrap.projects.top[0].name, 'alpha-secret', '--yes keeps names visible');
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('interactive: range choice, hide project names, display name', async () => {
  const r = await run(['--dry-run'], { answers: ['3', '2026-03-04', '2026-03-05', 'n', 'Seb'] });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stderr, /Show these names publicly\? \(Y\/n\)/);
  const wrap = JSON.parse(r.stdout);
  assert.equal(wrap.range.kind, 'custom');
  assert.deepEqual([wrap.range.from, wrap.range.to], ['2026-03-04', '2026-03-05']);
  assert.deepEqual(wrap.projects.top.map((p) => p.name), ['Project 1', 'Project 2']);
  assert.equal(wrap.displayName, 'Seb');
  assert.ok(!r.stdout.includes('beta') && !r.stdout.includes('gamma'));
});

test('interactive defaults: Enter keeps this year and visible names', async () => {
  const r = await run(['--dry-run'], { answers: ['', '', ''] });
  assert.equal(r.code, 0, r.stderr);
  const wrap = JSON.parse(r.stdout);
  assert.equal(wrap.range.label, '2026');
  assert.equal(wrap.projects.hidden, false);
  assert.equal(wrap.displayName, null);
});

test('flags: --hide-projects, --range all, --since/--until, --name', async () => {
  const r = await run(['--dry-run', '--yes', '--hide-projects', '--range', 'all', '--name=Ada']);
  const wrap = JSON.parse(r.stdout);
  assert.equal(wrap.range.kind, 'all');
  assert.equal(wrap.projects.top[0].name, 'Project 1');
  assert.equal(wrap.displayName, 'Ada');
  const c = JSON.parse((await run(['--dry-run', '--yes', '--since', '2026-03-05'])).stdout);
  assert.equal(c.range.kind, 'custom');
  assert.deepEqual(c.tools.map((t) => t.id), ['cursor']);
  assert.throws(() => parseArgs(['--range', 'decade']), /--range must be/);
  assert.throws(() => parseArgs(['--bogus']), /Unknown option/);
  assert.equal((await run(['--since', 'yesterday', '--yes', '--dry-run'])).code, 2);
});

test('thin data: retention tip is printed read-only, and skipped when retention is long', async () => {
  const settings = join(home, '.claude', 'settings.json');
  const r = await run(['--dry-run', '--yes']);
  assert.match(r.stderr, /cleanupPeriodDays/);
  assert.match(r.stderr, /never changes your settings/);
  assert.throws(() => readFileSync(settings), 'settings.json must not be created');

  writeFileSync(settings, JSON.stringify({ cleanupPeriodDays: 400 }));
  const before = readFileSync(settings, 'utf8');
  const r2 = await run(['--dry-run', '--yes']);
  assert.doesNotMatch(r2.stderr, /cleanupPeriodDays/);
  assert.equal(readFileSync(settings, 'utf8'), before);
});

test('no activity: friendly message and non-zero exit', async () => {
  const empty = mkdtempSync(join(tmpdir(), 'vw-none-'));
  mkdirSync(join(empty, '.claude', 'projects'), { recursive: true });
  const r = await run(['--dry-run', '--yes'], { home: empty });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /No AI coding activity found for 2026/);
  assert.equal(r.stdout, '');
});

test('bin: real process against fixture HOME', () => {
  const p = spawnSync(process.execPath, [BIN, '--dry-run', '--yes', '--range', 'all'], { env: fixtureEnv(home), encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  const wrap = JSON.parse(p.stdout);
  assert.equal(validateWrap(wrap).ok, true);
  assert.equal(wrap.totals.sessions, 3);
  const help = spawnSync(process.execPath, [BIN, '--help'], { encoding: 'utf8' });
  assert.match(help.stdout, /npx @vibewrap\/vibe-wrapped/);
});
