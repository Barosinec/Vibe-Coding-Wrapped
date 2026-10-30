// The persona catalogue. Shared by the CLI (which picks one) and the website (which renders it).
// Only the id is uploaded; names and copy live here so both sides stay in sync.

export const PERSONAS = [
  {
    id: 'midnight-architect',
    emoji: '🌙',
    name: 'Midnight Architect',
    tagline: 'You build while the world sleeps.',
    description: 'Most of your prompting happened between 10pm and 4am. The bugs are asleep, the coffee is cold, and the agent never complains.',
  },
  {
    id: 'dawn-shipper',
    emoji: '☀️',
    name: 'Dawn Shipper',
    tagline: 'Merged before breakfast.',
    description: 'You do your best vibe coding between 5am and 9am. By the time standup starts, it already shipped.',
  },
  {
    id: 'marathon-prompter',
    emoji: '🏃',
    name: 'Marathon Prompter',
    tagline: 'One more prompt. Then another.',
    description: 'Your sessions run for hours. You don’t start a task, you move in with it.',
  },
  {
    id: 'sprint-coder',
    emoji: '⚡',
    name: 'Sprint Coder',
    tagline: 'In, fixed, out.',
    description: 'Lots of short, punchy sessions. You know exactly what you want and you get it fast.',
  },
  {
    id: 'tool-hopper',
    emoji: '🔀',
    name: 'Tool Hopper',
    tagline: 'Why pick one agent when you can have three?',
    description: 'You spread your work across tools like a true connoisseur. Every agent gets a turn.',
  },
  {
    id: 'loyalist',
    emoji: '💍',
    name: 'The Loyalist',
    tagline: 'You found the one.',
    description: 'Nearly all of your vibe coding happened in a single tool. Other agents need not apply.',
  },
  {
    id: 'token-whale',
    emoji: '🐋',
    name: 'Token Whale',
    tagline: 'Context windows fear you.',
    description: 'Your sessions burn tokens at an industrial scale. Somewhere, a GPU cluster knows your name.',
  },
  {
    id: 'shell-commander',
    emoji: '🐚',
    name: 'Shell Commander',
    tagline: 'If it can be a command, it is a command.',
    description: 'Your agents lived in the terminal, running command after command on your behalf.',
  },
  {
    id: 'project-juggler',
    emoji: '🗺️',
    name: 'Project Juggler',
    tagline: 'So many repos, so little time.',
    description: 'You kept a lot of projects in the air at once — and somehow they all moved forward.',
  },
  {
    id: 'polite-one',
    emoji: '🙏',
    name: 'The Polite One',
    tagline: 'Please and thank you, always.',
    description: 'You say please to your agents far more than anyone needs to. When the robots take over, you’ll be spared.',
  },
];

export const PERSONA_IDS = PERSONAS.map((p) => p.id);

export function personaById(id) {
  return PERSONAS.find((p) => p.id === id) ?? null;
}

const clamp = (x) => Math.max(0, Math.min(1, x));

/**
 * Score every persona from computed stats (0..1, higher = stronger signal) and return
 * `{ id, scores }` for the strongest. Ties resolve in catalogue order.
 */
export function pickPersona(stats) {
  const t = stats.totals;
  const sessions = Math.max(1, t.sessions);
  const r = stats.rhythm;
  const toolShares = stats.tools.map((x) => x.share).sort((a, b) => b - a);
  const topModelShare = stats.models[0]?.share ?? 0;
  const agentCalls = stats.agent.totalCalls;
  const politeRate = t.prompts ? (stats.roast.please + stats.roast.thanks) / t.prompts : 0;

  let evenness = 0;
  if (toolShares.length >= 2) {
    const h = -toolShares.reduce((s, p) => s + (p > 0 ? p * Math.log(p) : 0), 0);
    evenness = h / Math.log(toolShares.length);
  }

  const scores = {
    'midnight-architect': r.nightShare >= 0.3 ? clamp(r.nightShare * 1.5) : 0,
    'dawn-shipper': r.morningShare >= 0.3 ? clamp(r.morningShare * 1.6) : 0,
    'marathon-prompter': clamp(stats.marathons.longSessionShare * 1.2),
    'sprint-coder': t.sessions >= 5 ? clamp(stats.marathons.shortSessionShare * 0.9) : 0,
    'tool-hopper': toolShares.length >= 2 && toolShares[1] >= 0.15 ? clamp(evenness * 0.95) : 0,
    loyalist: toolShares[0] >= 0.9 ? clamp(((toolShares[0] + topModelShare) / 2) * 0.7) : 0,
    'token-whale': clamp(t.tokens.total / sessions / 20_000_000),
    'shell-commander': agentCalls >= 20 ? clamp((stats.agent.shellCommands / agentCalls) * 1.4) : 0,
    'project-juggler': stats.projects.count >= 4 ? clamp(stats.projects.count / 10) : 0,
    'polite-one': t.prompts >= 10 ? clamp(politeRate * 3) : 0,
  };

  let best = 'loyalist';
  let bestScore = -1;
  for (const id of PERSONA_IDS) {
    if (scores[id] > bestScore) {
      best = id;
      bestScore = scores[id];
    }
  }
  // No signal at all (e.g. a handful of prompts): fall back to a friendly default.
  if (bestScore <= 0) best = toolShares.length >= 2 ? 'tool-hopper' : 'sprint-coder';
  return { id: best, scores };
}
