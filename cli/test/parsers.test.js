process.env.TZ = 'UTC';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseClaude } from '../src/parsers/claude.js';
import { parseCodex } from '../src/parsers/codex.js';
import { parseCursor } from '../src/parsers/cursor.js';
import { collectSessions } from '../src/parsers/index.js';
import { categorizeTool } from '../src/util.js';
import { SECRET_PROMPT, makeFixtureHome } from './fixtures.js';

const env = { PATH: process.env.PATH };
const home = await makeFixtureHome();
const count = (s, kind) => s.events.filter((e) => e.kind === kind).length;

test('claude: prompts, deduped responses, tools, tokens, subagents', async () => {
  const { found, sessions } = await parseClaude({ home, env });
  assert.equal(found, true);
  const main = sessions.find((s) => !s.isSubagent);
  const sub = sessions.find((s) => s.isSubagent);
  assert.equal(main.project, 'alpha-secret');
  assert.equal(count(main, 'prompt'), 3, 'human prompts only (no meta, no tool_result)');
  assert.equal(main.events.find((e) => e.kind === 'prompt').text, SECRET_PROMPT);
  assert.equal(count(main, 'assistant'), 3, 'split message counted once, <synthetic> skipped');
  assert.deepEqual(
    main.events.filter((e) => e.kind === 'tool').map((e) => e.toolName),
    ['Bash', 'Edit', 'Read'],
  );
  assert.deepEqual(main.tokens, { input: 30, output: 100, cached: 3300 }, 'final usage per message id');
  assert.equal(main.events.filter((e) => e.ack).length, 1);
  assert.ok(sub, 'subagent transcript is read');
  assert.deepEqual(sub.tokens, { input: 10, output: 7, cached: 1100 });
});

test('codex: skips injected context, last cumulative token_count, tool calls', async () => {
  const { sessions } = await parseCodex({ home, env });
  assert.equal(sessions.length, 1);
  const [s] = sessions;
  assert.equal(s.project, 'beta');
  assert.equal(count(s, 'prompt'), 1);
  assert.deepEqual(
    s.events.filter((e) => e.kind === 'tool').map((e) => e.toolName),
    ['exec', 'apply_patch'],
  );
  assert.equal(s.events.find((e) => e.kind === 'assistant').model, 'gpt-6.1-sol');
  assert.deepEqual(s.tokens, { input: 400, output: 100, cached: 600 });
});

test('cursor: composers, bubbles, workspace project, no tokens', async () => {
  const { sessions } = await parseCursor({ home, env, platform: 'linux' });
  assert.equal(sessions.length, 1, 'empty composer dropped');
  const [s] = sessions;
  assert.equal(s.project, 'gamma');
  assert.equal(count(s, 'prompt'), 1);
  assert.equal(count(s, 'tool'), 1);
  assert.equal(s.events.find((e) => e.kind === 'assistant').model, 'grok-4.6');
  assert.equal(s.tokens, null);
});

test('missing tools are skipped without error', async () => {
  const empty = mkdtempSync(join(tmpdir(), 'vw-empty-'));
  const r = await collectSessions({ home: empty, env, platform: 'linux' });
  assert.deepEqual(r.found, { 'claude-code': false, codex: false, cursor: false });
  assert.equal(r.sessions.length, 0);

  const onlyCodex = await makeFixtureHome({ claude: false, cursor: false });
  const r2 = await collectSessions({ home: onlyCodex, env, platform: 'linux' });
  assert.deepEqual(r2.found, { 'claude-code': false, codex: true, cursor: false });
  assert.equal(r2.sessions.length, 1);
});

test('tool names map to agent categories', () => {
  assert.equal(categorizeTool('Bash'), 'shell');
  assert.equal(categorizeTool('exec'), 'shell');
  assert.equal(categorizeTool('run_terminal_command_v2'), 'shell');
  assert.equal(categorizeTool('apply_patch'), 'edit');
  assert.equal(categorizeTool('read_file_v2'), 'read');
  assert.equal(categorizeTool('ripgrep_raw_search'), 'search');
  assert.equal(categorizeTool('WebFetch'), 'web');
  assert.equal(categorizeTool('mcp__github__create_issue'), 'mcp');
  assert.equal(categorizeTool('Agent'), 'agent');
  assert.equal(categorizeTool('something_new'), 'other');
});

// --- review regressions -----------------------------------------------------
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolveRange } from '../src/stats.js';
import { parseLocalDate } from '../src/util.js';

test('claude: assistant records without any id are not merged', async () => {
  const h = mkdtempSync(join(tmpdir(), 'vw-noid-'));
  const dir = join(h, '.claude', 'projects', '-x');
  mkdirSync(dir, { recursive: true });
  const rec = (t, out) => ({ type: 'assistant', cwd: '/x/p', timestamp: t, message: { model: 'claude-opus-5-5', content: [{ type: 'tool_use', name: 'Bash' }], usage: { input_tokens: 1, output_tokens: out } } });
  writeFileSync(join(dir, 's.jsonl'), [rec('2026-03-01T10:00:00Z', 5), rec('2026-03-01T10:01:00Z', 7)].map((r) => JSON.stringify(r)).join('\n'));
  const { sessions } = await parseClaude({ home: h, env });
  assert.equal(count(sessions[0], 'assistant'), 2);
  assert.equal(count(sessions[0], 'tool'), 2);
  assert.equal(sessions[0].tokens.output, 12);
});

test('cursor: agent-step bubble keys (<bubble>/s:<n>) belong to their composer', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const h = mkdtempSync(join(tmpdir(), 'vw-steps-'));
  const dir = join(h, '.config', 'Cursor', 'User', 'globalStorage');
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, 'state.vscdb'));
  db.exec('CREATE TABLE cursorDiskKV (key TEXT, value BLOB)');
  const put = (k, v) => db.prepare('INSERT INTO cursorDiskKV VALUES (?, ?)').run(k, JSON.stringify(v));
  put('composerData:c1', { workspaceIdentifier: { uri: { fsPath: '/w/delta' } } });
  put('bubbleId:c1:u1', { type: 1, createdAt: '2026-03-01T10:00:00Z', text: 'hi' });
  put('bubbleId:c1:u1/s:0', { type: 2, createdAt: '2026-03-01T10:00:30Z', text: 'step', toolFormerData: { name: 'read_file_v2' } });
  put('bubbleId:c1:u1/s:1', { type: 2, createdAt: '2026-03-01T10:01:00Z', text: 'Done.' });
  db.close();
  const { sessions } = await parseCursor({ home: h, env, platform: 'linux' });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, 'c1');
  assert.equal(sessions[0].project, 'delta');
  assert.equal(sessions[0].events.length, 3);
});

test('impossible dates are rejected', () => {
  assert.equal(parseLocalDate('2026-02-31'), null);
  assert.equal(parseLocalDate('2026-04-31'), null);
  assert.notEqual(parseLocalDate('2028-02-29'), null);
  assert.throws(() => resolveRange({ kind: 'custom', since: '2026-02-31' }), /Invalid --since/);
});

test('codex: input_text / output_text blocks are read', async () => {
  const { sessions } = await parseCodex({ home, env });
  const prompt = sessions[0].events.find((e) => e.kind === 'prompt');
  assert.equal(prompt.text, 'thanks, now add a CLI flag please');
  assert.equal(count(sessions[0], 'assistant'), 1);
});
