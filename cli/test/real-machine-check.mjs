// F01 A5: run the real CLI against this machine's actual history (read-only) and check the result.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateWrap } from '../src/schema.js';

const bin = fileURLToPath(new URL('../bin/vibe-wrapped.js', import.meta.url));
const p = spawnSync(process.execPath, [bin, '--dry-run', '--yes', '--range', 'all'], { encoding: 'utf8', maxBuffer: 8 << 20 });
process.stderr.write(p.stderr);
if (p.status !== 0) {
  console.error(`FAIL: exit code ${p.status}`);
  process.exit(1);
}
const wrap = JSON.parse(p.stdout);
const v = validateWrap(wrap);
const problems = [];
if (!v.ok) problems.push(`invalid payload: ${v.errors.join('; ')}`);
for (const id of ['claude-code', 'codex', 'cursor']) {
  const t = wrap.tools.find((x) => x.id === id);
  if (!t || t.sessions === 0) problems.push(`no activity reported for ${id}`);
}
if (wrap.totals.prompts === 0) problems.push('no prompts counted');
if (problems.length) {
  console.error('FAIL:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(
  `OK: ${wrap.totals.sessions} sessions, ${wrap.totals.prompts} prompts across ` +
    wrap.tools.map((t) => `${t.id} (${t.sessions})`).join(', ') +
    `; persona ${wrap.persona.id}; payload ${JSON.stringify(wrap).length} bytes`,
);
