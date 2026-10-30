// Claude Code: ~/.claude/projects/<dashed-cwd>/<sessionId>.jsonl (+ <sessionId>/subagents/*.jsonl)
import { basename, join } from 'node:path';
import { exists, isAck, newSession, projectName, readJsonl, toMs, walk } from '../util.js';

export function claudeRoot(home, env = process.env) {
  return join(env.CLAUDE_CONFIG_DIR || join(home, '.claude'), 'projects');
}

function promptText(rec) {
  if (rec.isMeta || rec.isCompactSummary) return null;
  const c = rec.message?.content;
  let text;
  if (typeof c === 'string') text = c;
  else if (Array.isArray(c)) {
    if (c.some((b) => b?.type === 'tool_result')) return null;
    text = c
      .filter((b) => b?.type === 'text')
      .map((b) => b.text)
      .join('\n');
    if (!text && !c.some((b) => b?.type === 'image')) return null;
  } else return null;
  const origin = rec.origin?.kind;
  if (origin) return origin === 'human' ? text : null;
  // Older logs have no origin: skip injected command/system wrappers.
  return text.trimStart().startsWith('<') ? null : text;
}

async function parseFile(file, isSubagent) {
  const session = newSession('claude-code', basename(file, '.jsonl'));
  session.isSubagent = isSubagent;
  const usageById = new Map();
  const seenMessages = new Set();
  const seenToolUses = new Set();
  let line = 0;

  for await (const rec of readJsonl(file)) {
    line++;
    if (!session.project && rec.cwd) session.project = projectName(rec.cwd);
    const ts = toMs(rec.timestamp);
    if (ts === null) continue;

    if (rec.type === 'user') {
      const text = promptText(rec);
      if (text !== null) session.events.push({ ts, kind: 'prompt', text });
    } else if (rec.type === 'assistant' && rec.message) {
      const m = rec.message;
      const id = m.id || rec.requestId || rec.uuid || `line-${line}`; // no id: never merge with another record
      if (m.usage) usageById.set(id, m.usage); // later lines of the same response carry final counts
      const blocks = Array.isArray(m.content) ? m.content : [];
      if (!seenMessages.has(id)) {
        seenMessages.add(id);
        if (m.model && m.model !== '<synthetic>') session.events.push({ ts, kind: 'assistant', model: m.model, ack: false });
      }
      for (const b of blocks) {
        if (b?.type === 'tool_use' && !(b.id && seenToolUses.has(b.id))) {
          if (b.id) seenToolUses.add(b.id);
          session.events.push({ ts, kind: 'tool', toolName: b.name });
        } else if (b?.type === 'text' && isAck(b.text)) {
          const last = session.events.findLast((e) => e.kind === 'assistant');
          if (last) last.ack = true;
        }
      }
    }
  }

  if (usageById.size) {
    const t = { input: 0, output: 0, cached: 0 };
    for (const u of usageById.values()) {
      t.input += u.input_tokens || 0;
      t.output += u.output_tokens || 0;
      t.cached += (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    }
    session.tokens = t;
  }
  return session;
}

export async function parseClaude({ home, env } = {}) {
  const root = claudeRoot(home, env);
  if (!exists(root)) return { found: false, sessions: [] };
  const files = walk(root, (n) => n.endsWith('.jsonl'), 4);
  const sessions = [];
  for (const f of files) {
    const s = await parseFile(f, /[\\/]subagents[\\/]/.test(f));
    if (s.events.length) sessions.push(s);
  }
  return { found: true, sessions, root };
}
