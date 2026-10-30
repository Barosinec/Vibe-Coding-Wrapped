# @vibewrap/vibe-wrapped

Spotify Wrapped for your AI coding sessions. Reads your Claude Code, Codex and Cursor history,
computes your stats on your machine, and gives you a shareable link with slides, a persona and a
story image. Nothing is uploaded or stored: your stats travel inside the link.

```sh
npx @vibewrap/vibe-wrapped
```

Requires Node.js 22.5 or newer.

## Privacy

- No upload, no account, no database. The link carries your stats; the website only decodes it.
- Only stats go into the link: counts, durations, model names, token totals, an activity heatmap
  and the folder names of your top projects. Prompts, code, file contents and full paths never
  leave your machine.
- You are asked whether project names may be shown. Answer "n" or pass `--hide-projects` and
  they become "Project 1" to "Project 5".
- `--dry-run` prints the exact JSON your link would contain.

## Usage

```sh
npx @vibewrap/vibe-wrapped [options]
```

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

Links open on `https://vibe-wrapped-ten.vercel.app`.

## Where logs are read from

- Claude Code: `~/.claude/projects/` (or `$CLAUDE_CONFIG_DIR/projects/`)
- Codex: `~/.codex/sessions/` (or `$CODEX_HOME/sessions/`)
- Cursor: `User/globalStorage/state.vscdb` under `~/.config/Cursor` (Linux),
  `~/Library/Application Support/Cursor` (macOS) or `%APPDATA%\Cursor` (Windows), or
  `$CURSOR_STATE_DB`

Tools you don't use are skipped.

## License

MIT
