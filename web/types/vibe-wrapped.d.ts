// Types for the shared contract published by the `vibe-wrapped` CLI package (plain JS).

declare module '@vibewrap/vibe-wrapped/schema' {
  export type ToolId = 'claude-code' | 'codex' | 'cursor';
  export type AgentCategory = 'shell' | 'edit' | 'read' | 'search' | 'web' | 'plan' | 'agent' | 'mcp' | 'other';
  export interface Tokens { total: number; input: number; output: number; cached: number }
  export interface WrapStats {
    schemaVersion: 1;
    generator: string;
    displayName: string | null;
    range: { kind: 'year' | 'all' | 'custom'; label: string; from: string | null; to: string | null };
    coverage: { firstDay: string | null; lastDay: string | null; activeDays: number; spanDays: number };
    totals: { sessions: number; prompts: number; activeMinutes: number; toolCalls: number; tokens: Tokens };
    tools: { id: ToolId; sessions: number; prompts: number; activeMinutes: number; share: number; tokens: Tokens; hasTokens: boolean }[];
    models: { name: string; tool: ToolId; turns: number; share: number }[];
    projects: { hidden: boolean; count: number; top: { name: string; activeMinutes: number; sessions: number }[] };
    rhythm: {
      byHour: number[];
      byWeekday: number[];
      days: { d: string; m: number }[];
      busiestHour: number;
      busiestWeekday: number;
      busiestDay: { date: string; minutes: number } | null;
      nightShare: number;
      morningShare: number;
    };
    marathons: {
      longestSession: { minutes: number; tool: ToolId; date: string } | null;
      longestStreak: { days: number; from: string; to: string } | null;
      avgSessionMinutes: number;
      longSessionShare: number;
      shortSessionShare: number;
    };
    agent: {
      totalCalls: number;
      shellCommands: number;
      fileEdits: number;
      fileReads: number;
      searches: number;
      webCalls: number;
      top: { category: AgentCategory; count: number }[];
    };
    roast: {
      please: number;
      thanks: number;
      stillBroken: number;
      why: number;
      youreRight: number;
      sorry: number;
      longestPromptChars: number;
      avgPromptChars: number;
    };
    persona: { id: string };
  }
  export const SCHEMA_VERSION: 1;
  export const MAX_PAYLOAD_BYTES: number;
  export const TOOL_IDS: ToolId[];
  export const TOOL_NAMES: Record<ToolId, string>;
  export function validateWrap(input: unknown): { ok: true; value: WrapStats } | { ok: false; errors: string[] };
  export function cleanLabel(s: unknown, max?: number): string;
}

declare module '@vibewrap/vibe-wrapped/personas' {
  export interface Persona { id: string; emoji: string; name: string; tagline: string; description: string }
  export const PERSONAS: Persona[];
  export const PERSONA_IDS: string[];
  export function personaById(id: string): Persona | null;
}

declare module '@vibewrap/vibe-wrapped/link' {
  import type { WrapStats } from '@vibewrap/vibe-wrapped/schema';
  export const MAX_CODE_LENGTH: number;
  export function encodeWrap(wrap: WrapStats): string;
  export function decodeWrap(code: string): { ok: true; value: WrapStats } | { ok: false; error: string };
}
