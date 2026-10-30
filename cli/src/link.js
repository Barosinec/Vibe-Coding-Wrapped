// The wrap lives in its link: nothing is uploaded or stored anywhere.
// code = "1" + base64url(deflateRaw(JSON)), where the heatmap days are packed as
// [firstDay, [minutes | null per calendar day]] to keep a full year short.
// Shared by the CLI (encodes) and the website (decodes and validates on every visit).

import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { validateWrap, isCalendarDate } from './schema.js';

const VERSION = '1';
export const MAX_CODE_LENGTH = 8000;
const MAX_JSON_BYTES = 64 * 1024;

const dayMs = 86_400_000;
const utc = (d) => Date.parse(`${d}T00:00:00Z`);
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

function packDays(days) {
  if (!days.length) return null;
  const start = utc(days[0].d);
  const span = Math.round((utc(days[days.length - 1].d) - start) / dayMs) + 1;
  const minutes = new Array(span).fill(null);
  for (const { d, m } of days) minutes[Math.round((utc(d) - start) / dayMs)] = m;
  return [days[0].d, minutes];
}

function unpackDays(packed) {
  if (packed === null) return [];
  if (!Array.isArray(packed) || packed.length !== 2 || !isCalendarDate(packed[0]) || !Array.isArray(packed[1]) || packed[1].length > 400) {
    throw new Error('bad days');
  }
  const start = utc(packed[0]);
  const days = [];
  packed[1].forEach((m, i) => {
    if (m !== null) days.push({ d: iso(start + i * dayMs), m });
  });
  return days;
}

/** Encode a validated wrap into a URL-safe code. */
export function encodeWrap(wrap) {
  const { days, ...rhythm } = wrap.rhythm;
  const packed = { ...wrap, rhythm: { ...rhythm, days: packDays(days) } };
  return VERSION + deflateRawSync(Buffer.from(JSON.stringify(packed)), { level: 9 }).toString('base64url');
}

/** Decode and validate an untrusted code. Returns { ok: true, value } or { ok: false, error }. */
export function decodeWrap(code) {
  if (typeof code !== 'string' || code.length < 2 || code.length > MAX_CODE_LENGTH || code[0] !== VERSION || !/^[A-Za-z0-9_-]+$/.test(code)) {
    return { ok: false, error: 'not a wrap link' };
  }
  let packed;
  try {
    const json = inflateRawSync(Buffer.from(code.slice(1), 'base64url'), { maxOutputLength: MAX_JSON_BYTES });
    packed = JSON.parse(json.toString('utf8'));
    if (!packed || typeof packed !== 'object' || !packed.rhythm || typeof packed.rhythm !== 'object') throw new Error('shape');
    packed.rhythm = { ...packed.rhythm, days: unpackDays(packed.rhythm.days) };
  } catch {
    return { ok: false, error: 'corrupt wrap link' };
  }
  const v = validateWrap(packed);
  return v.ok ? { ok: true, value: v.value } : { ok: false, error: v.errors.join('; ') };
}
