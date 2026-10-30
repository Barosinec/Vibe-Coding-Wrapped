process.env.TZ = 'UTC';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { collectSessions } from '../src/parsers/index.js';
import { resolveRange } from '../src/stats.js';
import { parseLocalDate, projectName } from '../src/util.js';

const env = { PATH: process.env.PATH };

test('dates rolling into the next month or year are rejected', () => {
  for (const bad of ['2026-12-32', '2026-02-29', '2026-13-01', '2026-00-10', '2026-06-00'])
    assert.equal(parseLocalDate(bad), null, bad);
  assert.notEqual(parseLocalDate('2026-12-31'), null);
  assert.throws(() => resolveRange({ kind: 'custom', since: '2026-01-01', until: '2026-12-32' }), /Invalid --until/);
});

test('malformed percent escapes in a project path do not abort parsing', async () => {
  assert.equal(projectName('/home/u/100%ZZ'), '100%ZZ');
  assert.equal(projectName('file:///home/u/my%20app'), 'my app');
  const h = mkdtempSync(join(tmpdir(), 'vw-pct-'));
  const dir = join(h, '.claude', 'projects', '-x');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 's.jsonl'),
    JSON.stringify({ type: 'user', cwd: '/home/u/100%ZZ', timestamp: '2026-03-01T10:00:00Z', origin: { kind: 'human' }, message: { role: 'user', content: 'hi' } }),
  );
  const r = await collectSessions({ home: h, env, platform: 'linux' });
  assert.equal(r.found['claude-code'], true);
  assert.equal(r.sessions[0].project, '100%ZZ');
});

test('a corrupt Cursor database yields a notice, not a crash', async () => {
  const h = mkdtempSync(join(tmpdir(), 'vw-corrupt-'));
  const dir = join(h, '.config', 'Cursor', 'User', 'globalStorage');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'state.vscdb'), 'this is not a sqlite database');
  const r = await collectSessions({ home: h, env, platform: 'linux' });
  assert.equal(r.found.cursor, false);
  assert.equal(r.notices.length, 1);
  assert.match(r.notices[0], /cursor/i);
});
