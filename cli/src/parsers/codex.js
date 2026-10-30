// Codex CLI/app: ~/.codex/sessions/YYYY/MM/DD/rollout-<iso>-<uuid>.jsonl
import { basename, join } from 'node:path';
import { exists, isAck, newSession, projectName, readJsonl, toMs, walk } from '../util.js';

export function codexRoot(home, env = process.env) {
  return join(env.CODEX_HOME || join(home, '.codex'), 'sessions');
}

const INJECTED = /^\s*(<|# AGENTS\.md|<environment_context|<user_instructions)/;

function messageText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => typeof c?.text === 'string')
    .map((c) => c.text)
    .join('\n');
}

async function parseFile(file) {
  const session = newSession('codex', basename(file, '.jsonl'));
  let model = null; // latest turn_context model, the fallback
  const modelByTurn = new Map();
  let lastUsage = null;

  for await (const rec of readJsonl(file)) {
    const p = rec.payload;
    if (!p) continue;
    const ts = toMs(rec.timestamp);

    if (rec.type === 'session_meta') {
      session.id = p.id || session.id;
      if (p.cwd) session.project = projectName(p.cwd);
      if (p.source && typeof p.source === 'object' && p.source.subagent) session.isSubagent = true;
      continue;
    }
    if (rec.type === 'turn_context') {
      if (p.model) {
        model = p.model;
        if (p.turn_id) modelByTurn.set(p.turn_id, p.model);
      }
      if (!session.project && p.cwd) session.project = projectName(p.cwd);
      continue;
    }
    if (rec.type === 'event_msg' && p.type === 'token_count' && p.info?.total_token_usage) {
      lastUsage = p.info.total_token_usage; // cumulative for the session
      continue;
    }
    if (ts === null || rec.type !== 'response_item') continue;

    if (p.type === 'message' && p.role === 'user') {
      const text = messageText(p.content);
      if (text && !INJECTED.test(text)) session.events.push({ ts, kind: 'prompt', text });
    } else if (p.type === 'message' && p.role === 'assistant') {
      const turnId = p.internal_chat_message_metadata_passthrough?.turn_id ?? p.turn_id;
      const turnModel = (turnId && modelByTurn.get(turnId)) || model || 'unknown';
      session.events.push({ ts, kind: 'assistant', model: turnModel, ack: isAck(messageText(p.content)) });
    } else if (p.type === 'function_call' || p.type === 'custom_tool_call') {
      session.events.push({ ts, kind: 'tool', toolName: p.name });
    } else if (p.type === 'local_shell_call') {
      session.events.push({ ts, kind: 'tool', toolName: 'shell' });
    }
  }

  if (lastUsage) {
    const cached = lastUsage.cached_input_tokens || 0;
    session.tokens = {
      input: Math.max(0, (lastUsage.input_tokens || 0) - cached),
      output: lastUsage.output_tokens || 0,
      cached,
    };
  }
  return session;
}

export async function parseCodex({ home, env } = {}) {
  const root = codexRoot(home, env);
  if (!exists(root)) return { found: false, sessions: [] };
  const files = walk(root, (n) => n.startsWith('rollout-') && n.endsWith('.jsonl'), 5);
  const sessions = [];
  for (const f of files) {
    const s = await parseFile(f);
    if (s.events.length) sessions.push(s);
  }
  return { found: true, sessions, root };
}
