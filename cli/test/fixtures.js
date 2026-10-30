// Synthetic HOME directories that mimic each tool's on-disk layout. All timestamps are UTC;
// tests run with TZ=UTC so local dates/hours are predictable.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const SECRET_PROMPT = 'please refactor the SuperSecretBillingEngine in /home/u/alpha-secret';
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const iso = (s) => new Date(s).toISOString();

function writeClaude(home) {
  const dir = join(home, '.claude', 'projects', '-home-u-alpha-secret');
  mkdirSync(join(dir, 'sess-a', 'subagents'), { recursive: true });
  const base = { cwd: '/home/u/alpha-secret', sessionId: 'sess-a', version: '2.0.0' };
  const usage = (o) => ({ input_tokens: 10, output_tokens: o, cache_read_input_tokens: 1000, cache_creation_input_tokens: 100 });
  writeFileSync(
    join(dir, 'sess-a.jsonl'),
    jsonl([
      { type: 'queue-operation', operation: 'enqueue', timestamp: iso('2026-03-02T22:00:00Z'), sessionId: 'sess-a' },
      { ...base, type: 'user', timestamp: iso('2026-03-02T22:00:00Z'), origin: { kind: 'human' }, message: { role: 'user', content: SECRET_PROMPT } },
      { ...base, type: 'user', isMeta: true, timestamp: iso('2026-03-02T22:00:01Z'), message: { role: 'user', content: '<local-command-caveat>x</local-command-caveat>' } },
      // one API response split over two lines (same message.id): count once, final usage wins
      { ...base, type: 'assistant', timestamp: iso('2026-03-02T22:02:00Z'), message: { id: 'msg_1', model: 'claude-opus-5-5', role: 'assistant', content: [{ type: 'text', text: "You're absolutely right, let me fix it." }], usage: usage(5) } },
      { ...base, type: 'assistant', timestamp: iso('2026-03-02T22:02:01Z'), message: { id: 'msg_1', model: 'claude-opus-5-5', role: 'assistant', content: [{ type: 'tool_use', id: 'tu_1', name: 'Bash', input: {} }], usage: usage(50) } },
      { ...base, type: 'user', timestamp: iso('2026-03-02T22:02:05Z'), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'ok' }] } },
      { ...base, type: 'assistant', timestamp: iso('2026-03-02T22:10:00Z'), message: { id: 'msg_2', model: 'claude-opus-5-5', role: 'assistant', content: [{ type: 'tool_use', id: 'tu_2', name: 'Edit', input: {} }], usage: usage(40) } },
      { ...base, type: 'user', timestamp: iso('2026-03-02T22:30:00Z'), origin: { kind: 'human' }, message: { role: 'user', content: 'why is it still broken? thanks' } },
      { ...base, type: 'assistant', timestamp: iso('2026-03-02T22:40:00Z'), message: { id: 'msg_3', model: 'claude-opus-5-5', role: 'assistant', content: [{ type: 'tool_use', id: 'tu_3', name: 'Read', input: {} }], usage: usage(10) } },
      // 2h later: new burst, gap is idle and must not count
      { ...base, type: 'user', timestamp: iso('2026-03-03T00:40:00Z'), message: { role: 'user', content: 'pls add tests' } },
      { ...base, type: 'assistant', timestamp: iso('2026-03-03T00:45:00Z'), message: { id: 'msg_4', model: '<synthetic>', role: 'assistant', content: [{ type: 'text', text: 'done' }] } },
    ]),
  );
  writeFileSync(
    join(dir, 'sess-a', 'subagents', 'agent-1.jsonl'),
    jsonl([
      { ...base, isSidechain: true, type: 'user', timestamp: iso('2026-03-02T22:03:00Z'), message: { role: 'user', content: 'subagent task text' } },
      { ...base, isSidechain: true, type: 'assistant', timestamp: iso('2026-03-02T22:04:00Z'), message: { id: 'msg_s1', model: 'claude-haiku-5-5', role: 'assistant', content: [{ type: 'tool_use', id: 'tu_s1', name: 'Grep', input: {} }], usage: usage(7) } },
    ]),
  );
}

function writeCodex(home) {
  const dir = join(home, '.codex', 'sessions', '2026', '03', '04');
  mkdirSync(dir, { recursive: true });
  const env = (timestamp, type, payload) => ({ timestamp: iso(timestamp), type, payload });
  writeFileSync(
    join(dir, 'rollout-2026-03-04T06-00-00-abc.jsonl'),
    jsonl([
      env('2026-03-04T06:00:00Z', 'session_meta', { id: 'codex-1', cwd: '/home/u/beta', source: 'cli' }),
      env('2026-03-04T06:00:00Z', 'turn_context', { cwd: '/home/u/beta', model: 'gpt-6.1-sol' }),
      env('2026-03-04T06:00:01Z', 'response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context>cwd</environment_context>' }] }),
      env('2026-03-04T06:00:02Z', 'response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'thanks, now add a CLI flag please' }] }),
      env('2026-03-04T06:01:00Z', 'response_item', { type: 'function_call', name: 'exec', arguments: '{}' }),
      env('2026-03-04T06:01:30Z', 'event_msg', { type: 'token_count', info: { total_token_usage: { input_tokens: 500, cached_input_tokens: 300, output_tokens: 40, total_tokens: 540 } } }),
      env('2026-03-04T06:02:00Z', 'response_item', { type: 'custom_tool_call', name: 'apply_patch', input: '' }),
      env('2026-03-04T06:05:00Z', 'response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Done.' }] }),
      env('2026-03-04T06:05:01Z', 'event_msg', { type: 'token_count', info: { total_token_usage: { input_tokens: 1000, cached_input_tokens: 600, output_tokens: 100, total_tokens: 1100 } } }),
    ]) + '{"broken json\n',
  );
}

async function writeCursor(home) {
  const { DatabaseSync } = await import('node:sqlite');
  const dir = join(home, '.config', 'Cursor', 'User', 'globalStorage');
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, 'state.vscdb'));
  db.exec('CREATE TABLE cursorDiskKV (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB)');
  const put = db.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)');
  put.run('composerData:comp-1', JSON.stringify({ composerId: 'comp-1', createdAt: Date.parse('2026-03-05T12:00:00Z'), modelConfig: { modelName: 'default' }, workspaceIdentifier: { id: 'x', uri: { fsPath: '/home/u/gamma' } } }));
  put.run('composerData:empty', JSON.stringify({ composerId: 'empty' }));
  put.run('bubbleId:comp-1:b1', JSON.stringify({ type: 1, createdAt: iso('2026-03-05T12:00:00Z'), text: 'make the button blue', modelInfo: { modelName: 'grok-4.6' } }));
  put.run('bubbleId:comp-1:b2', JSON.stringify({ type: 2, createdAt: iso('2026-03-05T12:01:00Z'), text: '', toolFormerData: { name: 'run_terminal_command_v2' } }));
  put.run('bubbleId:comp-1:b3', JSON.stringify({ type: 2, createdAt: iso('2026-03-05T12:03:00Z'), text: 'Done, the button is blue.' }));
  put.run('bubbleId:comp-1:b4', 'not json');
  db.close();
}

/** Create a fake HOME with logs for the given tools. Returns its path. */
export async function makeFixtureHome({ claude = true, codex = true, cursor = true } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'vw-home-'));
  if (claude) writeClaude(home);
  if (codex) writeCodex(home);
  if (cursor) await writeCursor(home);
  return home;
}

/** Env that points every tool at the fixture home (and nowhere else). */
export const fixtureEnv = (home) => ({ HOME: home, TZ: 'UTC', PATH: process.env.PATH });
