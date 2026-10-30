process.env.TZ = 'UTC';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { main, parseArgs } from '../src/cli.js';
import { MAX_CODE_LENGTH, decodeWrap, encodeWrap } from '../src/link.js';
import { DEFAULT_SITE, openInBrowser, resolveSite } from '../src/publish.js';
import { validateWrap } from '../src/schema.js';
import { fixtureEnv, makeFixtureHome } from './fixtures.js';

const BIN = fileURLToPath(new URL('../bin/vibe-wrapped.js', import.meta.url));
const NOW = Date.parse('2026-10-30T12:00:00Z');
const SITE = 'http://localhost:4999';
const home = await makeFixtureHome();

function sink() {
  let text = '';
  const s = new Writable({ write(chunk, _enc, cb) { text += chunk; cb(); } });
  return { stream: s, get text() { return text; } };
}

async function run(argv, { env = {}, opened = [] } = {}) {
  const out = sink();
  const err = sink();
  const stdin = new PassThrough();
  stdin.end();
  const code = await main(argv, {
    stdin, stdout: out.stream, stderr: err.stream, home,
    env: { ...fixtureEnv(home), VIBE_WRAPPED_SITE: SITE, ...env },
    platform: 'linux', now: NOW, interactive: false, color: false,
    open: (url) => opened.push(url),
  });
  return { code, stdout: out.text, stderr: err.text };
}

const dryRun = async () => JSON.parse((await run(['--dry-run', '--yes', '--range', 'all'])).stdout);
const linkOf = (stdout) => stdout.trim().split('\n').pop();
const codeOf = (link) => link.slice(link.lastIndexOf('/') + 1);

test('the link encodes exactly the --dry-run payload; nothing is fetched or written', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('network used'); };
  const before = readdirSync(home).sort();
  try {
    const opened = [];
    const r = await run(['--yes', '--range', 'all'], { opened });
    assert.equal(r.code, 0, r.stderr);
    const link = linkOf(r.stdout);
    assert.ok(link.startsWith(`${SITE}/w/1`), link);
    assert.deepEqual(opened, [link]);
    assert.match(r.stderr, /Nothing was uploaded or stored/);
    const decoded = decodeWrap(codeOf(link));
    assert.equal(decoded.ok, true, decoded.error);
    assert.deepEqual(decoded.value, await dryRun());
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(readdirSync(home).sort(), before, 'no files created in HOME');
});

test('--no-open and VIBE_WRAPPED_NO_OPEN print the link without opening it', async () => {
  const a = [];
  assert.equal((await run(['--yes', '--no-open'], { opened: a })).code, 0);
  const b = [];
  assert.equal((await run(['--yes'], { opened: b, env: { VIBE_WRAPPED_NO_OPEN: '1' } })).code, 0);
  assert.deepEqual([a, b], [[], []]);
});

test('site: public default, VIBE_WRAPPED_SITE override, bad values rejected', async () => {
  assert.equal(resolveSite({}), DEFAULT_SITE);
  assert.equal(resolveSite({ VIBE_WRAPPED_SITE: 'http://localhost:3000/' }), 'http://localhost:3000');
  assert.throws(() => resolveSite({ VIBE_WRAPPED_SITE: 'ftp://x' }), /http or https/);
  const r = await run(['--yes'], { env: { VIBE_WRAPPED_SITE: 'not a url' } });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Invalid VIBE_WRAPPED_SITE/);
});

test('round trip keeps heatmap gaps and zero-minute days', async () => {
  const w = await dryRun();
  w.rhythm.days = [
    { d: '2026-03-02', m: 20 },
    { d: '2026-03-03', m: 0 },
    { d: '2026-03-07', m: 5 },
  ];
  const v = decodeWrap(encodeWrap(w));
  assert.equal(v.ok, true, v.error);
  assert.deepEqual(v.value.rhythm.days, w.rhythm.days);
  w.rhythm.days = [];
  assert.deepEqual(decodeWrap(encodeWrap(w)).value.rhythm.days, []);
});

test('links stay short: typical wrap < 2000 chars, a full year of daily activity < 2500', async () => {
  const w = await dryRun();
  assert.ok(encodeWrap(w).length < 2000, `typical ${encodeWrap(w).length}`);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  w.rhythm.days = Array.from({ length: 365 }, (_, i) => ({ d: new Date(Date.UTC(2026, 0, 1) + i * 864e5).toISOString().slice(0, 10), m: Math.floor(rand() * 600) }));
  w.coverage = { firstDay: '2026-01-01', lastDay: '2026-12-31', activeDays: 365, spanDays: 365 };
  assert.equal(validateWrap(w).ok, true);
  const len = encodeWrap(w).length;
  assert.ok(len < 2500, `full year ${len}`);
  assert.equal(decodeWrap(encodeWrap(w)).ok, true);
});

test('decode rejects garbage, wrong versions, oversized and schema-invalid codes', async () => {
  const w = await dryRun();
  const good = encodeWrap(w);
  for (const bad of ['', '1', 'demo', '2' + good.slice(1), good.slice(0, -10), '1!!!', '1' + 'A'.repeat(MAX_CODE_LENGTH)])
    assert.equal(decodeWrap(bad).ok, false, `accepted ${bad.slice(0, 20)}`);
  const evil = { ...w, persona: { id: 'hacker' } };
  assert.equal(decodeWrap(encodeWrap(evil)).ok, false);
  // A zip bomb (tiny code, huge JSON) is refused by the inflate size cap.
  const { deflateRawSync } = await import('node:zlib');
  const bomb = '1' + deflateRawSync(Buffer.from(JSON.stringify({ x: 'a'.repeat(5_000_000) }))).toString('base64url');
  assert.ok(bomb.length < MAX_CODE_LENGTH);
  assert.equal(decodeWrap(bomb).ok, false);
  // Unknown fields smuggled into a link are stripped by validation.
  const extra = decodeWrap(encodeWrap({ ...w, prompts: ['secret'] }));
  assert.equal(extra.ok, true);
  assert.equal(extra.value.prompts, undefined);
});

test('removed storage commands are gone', () => {
  for (const argv of [['delete'], ['--new'], ['--api', 'http://x']]) assert.throws(() => parseArgs(argv), /Unknown/);
  assert.equal(parseArgs(['--no-open']).noOpen, true);
});

test('openInBrowser: any http(s) URL; no other schemes; cmd metacharacters skipped on Windows', () => {
  const calls = [];
  const fake = (cmd, args) => {
    calls.push([cmd, args]);
    return { on() {}, unref() {} };
  };
  openInBrowser('https://vibe.test/w/1abc_-XYZ?ref=cli#top', 'linux', fake);
  openInBrowser('https://vibe.test/w/1abc', 'darwin', fake);
  openInBrowser('https://vibe.test/w/1abc', 'win32', fake);
  for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'not a url', '']) openInBrowser(bad, 'linux', fake);
  openInBrowser('https://vibe.test/w/a?x=1&calc', 'win32', fake);
  assert.deepEqual(calls, [
    ['xdg-open', ['https://vibe.test/w/1abc_-XYZ?ref=cli#top']],
    ['open', ['https://vibe.test/w/1abc']],
    ['cmd', ['/c', 'start', '""', 'https://vibe.test/w/1abc']],
  ]);
});

test('bin: real process prints a decodable link', () => {
  const p = spawnSync(process.execPath, [BIN, '--yes', '--no-open', '--name', 'Bin Test'], {
    env: { ...fixtureEnv(home), VIBE_WRAPPED_SITE: SITE },
    encoding: 'utf8',
  });
  assert.equal(p.status, 0, p.stderr);
  const v = decodeWrap(codeOf(linkOf(p.stdout)));
  assert.equal(v.ok, true, v.error);
  assert.equal(v.value.displayName, 'Bin Test');
});
