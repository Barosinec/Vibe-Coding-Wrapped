process.env.TZ = 'UTC';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseCodex } from '../src/parsers/codex.js';
import { computeWrap, resolveRange } from '../src/stats.js';

const all = resolveRange({ kind: 'all' });
function session(project, day) {
  const ts = Date.parse(`2026-03-${String(day).padStart(2, '0')}T13:00:00Z`);
  return {
    tool: 'codex', id: project, project, isSubagent: false, tokens: null,
    events: [
      { ts, kind: 'prompt', text: 'go' },
      { ts: ts + 60_000, kind: 'tool', toolName: 'Read' },
      { ts: ts + 120_000, kind: 'assistant', model: 'm' },
    ],
  };
}

test('hidden projects do not reveal the real project count; persona still uses it', () => {
  const ss = Array.from({ length: 12 }, (_, i) => session(`secret-${i}`, i + 1));
  const shown = computeWrap(ss, { range: all });
  const hidden = computeWrap(ss, { range: all, hideProjects: true });
  assert.equal(shown.projects.count, 12);
  assert.equal(hidden.projects.count, 5);
  assert.equal(hidden.projects.top.length, 5);
  assert.equal(hidden.persona.id, shown.persona.id);
  assert.equal(hidden.persona.id, 'project-juggler');
  assert.ok(!JSON.stringify(hidden).includes('secret-'));
});

test('codex: assistant messages use the model of their own turn', async () => {
  const h = mkdtempSync(join(tmpdir(), 'vw-turns-'));
  const dir = join(h, '.codex', 'sessions', '2026', '03', '01');
  mkdirSync(dir, { recursive: true });
  const rec = (t, type, payload) => JSON.stringify({ timestamp: `2026-03-01T10:0${t}:00Z`, type, payload });
  const meta = (turn) => ({ internal_chat_message_metadata_passthrough: { turn_id: turn } });
  writeFileSync(
    join(dir, 'rollout-x.jsonl'),
    [
      rec(0, 'session_meta', { id: 's', cwd: '/w/p' }),
      rec(0, 'turn_context', { turn_id: 't1', model: 'model-a' }),
      rec(1, 'turn_context', { turn_id: 't2', model: 'model-b' }),
      rec(2, 'response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'from t1' }], ...meta('t1') }),
      rec(3, 'response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'from t2' }], ...meta('t2') }),
      rec(4, 'response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'no turn id' }] }),
    ].join('\n'),
  );
  const { sessions } = await parseCodex({ home: h, env: { PATH: process.env.PATH } });
  assert.deepEqual(
    sessions[0].events.filter((e) => e.kind === 'assistant').map((e) => e.model),
    ['model-a', 'model-b', 'model-b'],
  );
});
