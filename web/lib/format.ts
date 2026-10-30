import type { ToolId } from '@vibewrap/vibe-wrapped/schema';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const TOOL = {
  'claude-code': { name: 'Claude Code', color: '#FF7A3D' },
  codex: { name: 'Codex', color: '#19C37D' },
  cursor: { name: 'Cursor', color: '#7C6CFF' },
} satisfies Record<ToolId, { name: string; color: string }>;

/** Each persona's signature gradient (slides, share images). */
export const PERSONA_GRADIENT: Record<string, [string, string]> = {
  'midnight-architect': ['#0B1460', '#7A2BFF'],
  'dawn-shipper': ['#FF9A3D', '#FF4F8B'],
  'marathon-prompter': ['#FF4D2E', '#FFB21A'],
  'sprint-coder': ['#00C2FF', '#2BFF88'],
  'tool-hopper': ['#7C6CFF', '#19C37D'],
  loyalist: ['#FF3DAA', '#8A1FFF'],
  'token-whale': ['#0047FF', '#00E0C6'],
  'shell-commander': ['#0E5B3A', '#19C37D'],
  'project-juggler': ['#FF5E1A', '#7C6CFF'],
  'polite-one': ['#FF8FC7', '#FFC94D'],
};

export function fmtCount(n: number): string {
  if (n >= 1e9) return `${trim(n / 1e9)}B`;
  if (n >= 1e6) return `${trim(n / 1e6)}M`;
  if (n >= 1e4) return `${trim(n / 1e3)}K`;
  return Math.round(n).toLocaleString('en-US');
}
const trim = (x: number) => (x >= 100 ? Math.round(x).toString() : x.toFixed(1).replace(/\.0$/, ''));

export function fmtHours(minutes: number): { value: string; unit: string } {
  if (minutes < 120) return { value: String(minutes), unit: minutes === 1 ? 'minute' : 'minutes' };
  const h = minutes / 60;
  return { value: h >= 100 ? Math.round(h).toLocaleString('en-US') : h.toFixed(1).replace(/\.0$/, ''), unit: 'hours' };
}

export function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtDay(d: string, withYear = false): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${MONTHS[m - 1]} ${day}${withYear ? `, ${y}` : ''}`;
}

export const fmtHour = (h: number) => (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`);
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** "claude-opus-5-5" -> "Claude Opus 5.5", "gpt-6.1-sol" -> "GPT 6.1 Sol" */
export function prettyModel(name: string): string {
  if (name === 'Cursor Auto' || name === 'unknown') return name === 'unknown' ? 'Unknown model' : name;
  const parts = name.split('-');
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (/^\d+$/.test(p) && /^\d+$/.test(parts[i + 1] ?? '') && parts[i + 1].length <= 2) {
      out.push(`${p}.${parts[i + 1]}`);
      i++;
    } else if (/^(gpt|ai)$/i.test(p)) out.push(p.toUpperCase());
    else out.push(p.charAt(0).toUpperCase() + p.slice(1));
  }
  return out.join(' ');
}

// One copy of War and Peace is roughly 780K tokens.
export function tokenComparison(total: number): string {
  const wp = total / 780_000;
  if (wp >= 2) return `That’s ${fmtCount(Math.round(wp))} copies of War and Peace.`;
  const pages = Math.max(1, Math.round(total / 650));
  return `That’s about ${fmtCount(pages)} pages of novel.`;
}

export const AGENT_LABEL: Record<string, string> = {
  shell: 'shell commands',
  edit: 'file edits',
  read: 'file reads',
  search: 'code searches',
  web: 'web lookups',
  plan: 'plan updates',
  agent: 'sub-agents spawned',
  mcp: 'MCP tool calls',
  other: 'other tool calls',
};
