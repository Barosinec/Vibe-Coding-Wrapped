// Which slides a wrap shows. Thin data skips slides that would look empty.
import type { WrapStats } from '@vibewrap/vibe-wrapped/schema';

export const SLIDE_ORDER = ['intro', 'numbers', 'tools', 'models', 'tokens', 'projects', 'rhythm', 'marathons', 'agent', 'roast', 'persona', 'summary'] as const;
export type SlideId = (typeof SLIDE_ORDER)[number];

const RULES: Record<SlideId, (s: WrapStats) => boolean> = {
  intro: () => true,
  numbers: (s) => s.totals.sessions > 0,
  tools: (s) => s.tools.length > 0,
  models: (s) => s.models.length > 0,
  tokens: (s) => s.totals.tokens.total > 0,
  projects: (s) => s.projects.top.length > 0,
  rhythm: (s) => s.totals.activeMinutes >= 60 && s.coverage.activeDays >= 3,
  marathons: (s) => (s.marathons.longestSession?.minutes ?? 0) >= 30 || (s.marathons.longestStreak?.days ?? 0) >= 3,
  agent: (s) => s.agent.totalCalls >= 20,
  roast: (s) => s.totals.prompts >= 20,
  persona: () => true,
  summary: () => true,
};

export const availableSlides = (s: WrapStats): SlideId[] => SLIDE_ORDER.filter((id) => RULES[id](s));

/** The heatmap only reads as a pattern with enough days. */
export const showHeatmap = (s: WrapStats) => s.coverage.activeDays >= 14;
/** A one-day "streak" isn't worth celebrating. */
export const showStreak = (s: WrapStats) => (s.marathons.longestStreak?.days ?? 0) >= 2;
