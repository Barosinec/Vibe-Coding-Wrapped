// Human-readable terminal summary of a wrap.
import { personaById } from './personas.js';
import { TOOL_NAMES } from './schema.js';

const WEEKDAYS = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtCount(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString('en-US');
}

export const fmtHour = (h) => (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`);

export function fmtDay(d) {
  const [, m, day] = d.split('-').map(Number);
  return `${MONTHS[m - 1]} ${day}`;
}

export function coverageLine(wrap) {
  const c = wrap.coverage;
  if (!c.firstDay) return 'No activity in this range';
  const days = `${c.activeDays} active day${c.activeDays === 1 ? '' : 's'}`;
  return `Based on ${days} of history (${fmtDay(c.firstDay)} – ${fmtDay(c.lastDay)})`;
}

export function renderSummary(wrap, { color = false } = {}) {
  const b = (s) => (color ? `\x1b[1m${s}\x1b[22m` : s);
  const dim = (s) => (color ? `\x1b[2m${s}\x1b[22m` : s);
  const accent = (s) => (color ? `\x1b[35m${s}\x1b[39m` : s);
  const t = wrap.totals;
  const persona = personaById(wrap.persona.id);
  const row = (label, value) => `  ${dim(label.padEnd(10))} ${value}`;
  const lines = [
    '',
    `  ${accent('✦')} ${b(`Vibe Wrapped — ${wrap.range.label}`)}${wrap.displayName ? dim(`  for ${wrap.displayName}`) : ''}`,
    `  ${dim(coverageLine(wrap))}`,
    '',
    row('Sessions', `${b(fmtCount(t.sessions))}   ${dim('Prompts')} ${b(fmtCount(t.prompts))}   ${dim('Time with AI')} ${b(fmtDuration(t.activeMinutes))}`),
  ];
  if (t.tokens.total > 0) lines.push(row('Tokens', b(fmtCount(t.tokens.total))));
  if (wrap.tools.length)
    lines.push(row('Tools', wrap.tools.map((x) => `${TOOL_NAMES[x.id]} ${Math.round(x.share * 100)}%`).join(dim(' · '))));
  if (wrap.models[0]) lines.push(row('Top model', wrap.models[0].name));
  if (wrap.projects.top[0]) lines.push(row('Projects', wrap.projects.top.map((p) => p.name).join(dim(' · '))));
  if (t.activeMinutes > 0) lines.push(row('Busiest', `${fmtHour(wrap.rhythm.busiestHour)} · ${WEEKDAYS[wrap.rhythm.busiestWeekday]}`));
  if (wrap.marathons.longestStreak) lines.push(row('Streak', `${wrap.marathons.longestStreak.days} day${wrap.marathons.longestStreak.days === 1 ? '' : 's'}`));
  if (persona) lines.push('', `  ${persona.emoji}  ${b(persona.name)} ${dim('— ' + persona.tagline)}`);
  lines.push('');
  return lines.join('\n');
}
