import { homedir } from 'node:os';
import { parseClaude } from './claude.js';
import { parseCodex } from './codex.js';
import { parseCursor } from './cursor.js';

export const PARSERS = [
  ['claude-code', parseClaude],
  ['codex', parseCodex],
  ['cursor', parseCursor],
];

/**
 * Read every supported tool's history. A tool that is missing or fails is skipped with a notice;
 * it never aborts the whole run.
 * Returns { sessions, found: { [toolId]: boolean }, notices: string[], roots: { [toolId]: path } }.
 */
export async function collectSessions({ home = homedir(), env = process.env, platform = process.platform } = {}) {
  const notices = [];
  const found = {};
  const roots = {};
  const sessions = [];
  for (const [id, parse] of PARSERS) {
    try {
      const r = await parse({ home, env, platform, onNotice: (n) => notices.push(n) });
      found[id] = r.found && !r.skipped;
      if (r.root) roots[id] = r.root;
      sessions.push(...r.sessions);
    } catch (err) {
      found[id] = false;
      notices.push(`${id} history skipped: ${err?.message ?? err}`);
    }
  }
  return { sessions, found, notices, roots };
}
