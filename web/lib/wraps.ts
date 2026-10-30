import { decodeWrap } from '@vibewrap/vibe-wrapped/link';
import type { WrapStats } from '@vibewrap/vibe-wrapped/schema';
import { DEMO_ID, DEMO_STATS } from './demo';

/**
 * A wrap lives entirely in its link: decode and validate the code from the URL.
 * Nothing is stored. "demo" serves the built-in sample. Invalid codes give null (-> 404).
 */
export function loadWrap(code: string): WrapStats | null {
  if (code === DEMO_ID) return DEMO_STATS;
  const r = decodeWrap(code);
  return r.ok ? (r.value as WrapStats) : null;
}
