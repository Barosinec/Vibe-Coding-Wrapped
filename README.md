# Vibe Wrapped

Spotify Wrapped for your AI coding sessions. Run one command and get a shareable story of your
year with Claude Code, Codex and Cursor: time spent, prompts, models, tokens, projects, your
coding rhythm, a few cheeky roast stats and a persona.

```sh
npx @vibewrap/vibe-wrapped
```

The CLI reads the logs on your machine, computes the stats locally, shows you a summary, and
gives you a link like `https://vibe-wrapped-ten.vercel.app/w/1fVXL…` with your whole wrap packed
inside it. There is no account, no upload and no database.

## Privacy

- Nothing is uploaded or stored. Your stats are compressed into the link itself; the website just
  decodes the link when someone opens it, and keeps nothing.
- Only stats go into the link: counts, durations, model names, token totals, an activity heatmap
  and the folder names of your top projects. Prompts, code, file contents and full paths never
  leave your machine.
- Roast stats (for example how often you said "please") are counted locally; only the totals go
  into the link.
- The CLI asks whether your top project names may be shown. Answer "n" or pass `--hide-projects`
  and they become "Project 1" to "Project 5".
- `--dry-run` prints the exact JSON your link would contain.
- Anyone with your link can see your wrap, and a shared link can't be taken back, so share it
  the way you would share a screenshot.

## Usage

```sh
npx @vibewrap/vibe-wrapped [options]
```

Without options the CLI asks for the time range, whether to show project names and an optional
display name, then prints your link and opens it in the browser. Running it again makes a new
link with your latest stats.

| Option | What it does |
|---|---|
| `--range year\|all\|custom` | Time range. Default: the current calendar year. |
| `--since YYYY-MM-DD` | Start of a custom range (implies `--range custom`). |
| `--until YYYY-MM-DD` | End of a custom range. Default: today. |
| `--name <text>` | Display name shown on your wrap. |
| `--hide-projects` | Show your top projects as "Project 1-5" without asking. |
| `--dry-run` | Print the exact JSON your link would contain, then stop. |
| `-y`, `--yes` | Skip all questions and use the defaults. |
| `--no-open` | Print the link but do not open the browser. |
| `-h`, `--help` | Show help. |
| `-v`, `--version` | Show the version. |

Node.js 22.5 or newer is required (Cursor history is read with the built-in `node:sqlite`).

## Supported tools

Tools you don't have are skipped. Each location can be overridden with the environment
variable shown.

| Tool | Logs read from |
|---|---|
| Claude Code | `~/.claude/projects/*/*.jsonl` (`CLAUDE_CONFIG_DIR`) |
| Codex | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (`CODEX_HOME`) |
| Cursor | `state.vscdb` in Cursor's `User/globalStorage` folder (`CURSOR_STATE_DB`): `~/.config/Cursor` on Linux (`XDG_CONFIG_HOME`), `~/Library/Application Support/Cursor` on macOS, `%APPDATA%\Cursor` on Windows |

Cursor does not record token counts, so the tokens slide covers Claude Code and Codex only.

Claude Code deletes transcripts after 30 days by default. If your wrap looks thin, set
`"cleanupPeriodDays": 365` in `~/.claude/settings.json` to keep more history for next time. The
CLI prints this tip but never changes your settings.

## Repository layout

```
cli/   the @vibewrap/vibe-wrapped npm package (plain ESM JavaScript, no runtime dependencies)
web/   the website that renders wrap links (Next.js, no database)
```

The website imports the link codec and stats schema from the CLI package, so both sides validate
the same contract.

## Local development

```sh
npm install                 # installs both workspaces (cli and web)
node --test cli/test/       # CLI unit tests
npm run dev -w web          # website on http://localhost:3000
npm run e2e -w web          # Playwright end-to-end tests (builds and starts the site)
node cli/test/publish-e2e.mjs   # CLI -> link -> local website, end to end
```

Try the CLI against your local site:

```sh
node cli/bin/vibe-wrapped.js --dry-run
VIBE_WRAPPED_SITE=http://localhost:3000 node cli/bin/vibe-wrapped.js
```

## Privacy and terms

See [the privacy page](https://vibe-wrapped-ten.vercel.app/privacy) and
[the terms](https://vibe-wrapped-ten.vercel.app/terms). In short: the CLI runs locally, nothing is
uploaded or stored, and the project is provided as-is.

## License

MIT. See [LICENSE](LICENSE).
