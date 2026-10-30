// Cursor: globalStorage/state.vscdb (SQLite), table cursorDiskKV
//   composerData:<composerId>             one agent/chat conversation
//   bubbleId:<composerId>:<bubbleId>      one message (type 1 = user, 2 = AI)
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exists, isAck, newSession, projectName, toMs } from '../util.js';

export function cursorDbPath(home, env = process.env, platform = process.platform) {
  if (env.CURSOR_STATE_DB) return env.CURSOR_STATE_DB;
  const base =
    platform === 'darwin'
      ? join(home, 'Library', 'Application Support', 'Cursor')
      : platform === 'win32'
        ? join(env.APPDATA || join(home, 'AppData', 'Roaming'), 'Cursor')
        : join(env.XDG_CONFIG_HOME || join(home, '.config'), 'Cursor');
  return join(base, 'User', 'globalStorage', 'state.vscdb');
}

async function openDb(file) {
  const { DatabaseSync } = await import('node:sqlite');
  try {
    return { db: new DatabaseSync(file, { readOnly: true }), cleanup: () => {} };
  } catch {
    // Cursor may hold a lock; read a private copy instead.
    const dir = mkdtempSync(join(tmpdir(), 'vibe-wrapped-'));
    const copy = join(dir, 'state.vscdb');
    copyFileSync(file, copy);
    return { db: new DatabaseSync(copy, { readOnly: true }), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
  }
}

function parseValue(v) {
  try {
    return JSON.parse(typeof v === 'string' ? v : Buffer.from(v).toString('utf8'));
  } catch {
    return null;
  }
}

const modelLabel = (m) => (!m || m === 'default' ? 'Cursor Auto' : m);

export async function parseCursor({ home, env, platform, onNotice } = {}) {
  const file = cursorDbPath(home, env, platform);
  if (!exists(file)) return { found: false, sessions: [] };

  let handle;
  try {
    handle = await openDb(file);
  } catch (err) {
    const old = /node:sqlite|ERR_UNKNOWN_BUILTIN_MODULE/.test(String(err?.message ?? err) + (err?.code ?? ''));
    onNotice?.(
      old
        ? 'Cursor history skipped: reading it needs Node.js 22.5 or newer.'
        : `Cursor history skipped: could not open its database (${err?.message ?? err}).`,
    );
    return { found: true, sessions: [], skipped: true };
  }

  const { db, cleanup } = handle;
  try {
    const composers = new Map();
    for (const row of db.prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'").iterate()) {
      const v = parseValue(row.value);
      if (!v) continue;
      const id = row.key.slice('composerData:'.length);
      const s = newSession('cursor', id);
      s.defaultModel = modelLabel(v.modelConfig?.modelName);
      s.isSubagent = Boolean(v.isBestOfNSubcomposer);
      const ws = v.workspaceIdentifier?.uri;
      s.project = projectName(ws?.fsPath || ws?.path || ws?.external);
      composers.set(id, s);
    }

    const bubbles = [];
    for (const row of db.prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'").iterate()) {
      // bubbleId:<composerId>:<bubbleId>, or bubbleId:<composerId>:<userBubbleId>/s:<step> for agent steps.
      // Composer ids are UUIDs, so the composer is always the second segment.
      const composerId = row.key.split(':')[1];
      const v = parseValue(row.value);
      const ts = toMs(v?.createdAt);
      if (!v || ts === null) continue;
      bubbles.push({ composerId, v, ts });
    }
    bubbles.sort((a, b) => a.ts - b.ts);

    for (const { composerId, v, ts } of bubbles) {
      let s = composers.get(composerId);
      if (!s) {
        s = newSession('cursor', composerId);
        s.defaultModel = 'Cursor Auto';
        composers.set(composerId, s);
      }
      if (v.type === 1) {
        if (v.modelInfo?.modelName) s.defaultModel = modelLabel(v.modelInfo.modelName);
        if (!s.project && Array.isArray(v.workspaceUris) && v.workspaceUris[0]) s.project = projectName(v.workspaceUris[0]);
        s.events.push({ ts, kind: 'prompt', text: typeof v.text === 'string' ? v.text : '' });
      } else if (v.type === 2) {
        const tool = v.toolFormerData?.name;
        if (tool) s.events.push({ ts, kind: 'tool', toolName: tool });
        else s.events.push({ ts, kind: 'assistant', model: modelLabel(v.modelInfo?.modelName || s.defaultModel), ack: isAck(v.text) });
      }
    }

    const sessions = [...composers.values()].filter((s) => s.events.length);
    for (const s of sessions) delete s.defaultModel;
    return { found: true, sessions };
  } finally {
    db.close();
    cleanup();
  }
}
