# Docker Compose Debugger

Browser-based tool that turns messy Docker Compose output into clean, readable debugging views. Paste output from `docker-autocompose`, `docker compose config`, or raw `docker-compose.yml` — get sanitized YAML with sensitive values redacted, per-service cards, volume comparison tables, and a markdown table ready for Discord or GitHub support channels.

**Live:** [baker-scripts.github.io/docker-compose-debugger](https://baker-scripts.github.io/docker-compose-debugger/)

## Features

### Three views

- **Table** *(default)* — service overview + User/Group comparison + Volume comparison, all in one place. Best for quickly spotting UID/GID mismatches or which services share which host paths.
- **Cards** — per-service view showing image, ports, volumes, networks, environment, and extras (user, restart policy, hostname, depends_on, resource limits). Empty sections are omitted.
- **YAML** — full sanitized YAML output, ready to paste into a gist.

### Copy as Markdown — GitHub or Discord

Two dedicated buttons:

- **Copy MD (GitHub)** — `### heading` + bare pipe-table markdown. Renders as a real table on GitHub.
- **Copy MD (Discord)** — `**bold**` labels + each table wrapped in a fenced code block. Discord doesn't render pipe tables, so the fence preserves alignment in monospace and prevents `_underscore_` / `*asterisk*` characters in volume paths from triggering inline formatting.

Both formats include the Services overview, User/Group comparison, and Volume comparison sections.

### User / Group merging

The "User" column merges three sources of identity into a single value so you can spot mismatches at a glance:

- explicit `user: <UID>:<GID>` directive
- `PUID` / `PGID` env vars (linuxserver convention)
- `group_add` and `UMASK` in the comparison table

Lookups are case-insensitive (so a typo'd `Puid` still surfaces). When the directive matches `PUID:PGID`, only one value is shown; when they conflict, the directive is shown with the env values annotated.

### Redaction

| What | Example | Result |
|------|---------|--------|
| Sensitive env keys | `MYSQL_PASSWORD`, `API_KEY`, `DATABASE_URL`, `AWS_SECRET_ACCESS_KEY`, `*_FILE` variants | value replaced with `**REDACTED**` |
| Inline credentials in URLs | `postgres://<user>:<pw>@db/app` | redacted regardless of the env-var name |
| Vendor token formats | GitHub PATs (`ghp_…`), AWS access keys (`AKIA…`), Tailscale auth keys (`tskey-…-…`), Discord/Slack webhooks, JWTs | redacted regardless of the env-var name |
| Email addresses | `NOTIFY: user@example.com` | `NOTIFY: **REDACTED**` |
| Home directory paths | `/home/john/media:/tv` | `~/media:/tv` |

Safe-listed keys (kept as-is): `PUID`, `PGID`, `TZ`, `UMASK`, `LOG_LEVEL`, `WEBUI_PORT`, etc.

### Noise Stripping

Removes auto-generated fields that clutter compose output:

- `com.docker.compose.*` labels
- S6-overlay env vars (`S6_*`)
- Default runtime values (`ipc: private`, `entrypoint: /init`)
- Locale/path env vars (`PATH`, `LANG`, `XDG_*`)
- Empty env values and empty maps/arrays

### Advisories

Detects common misconfigurations and shows warnings with links to documentation:

- **Hardlinks advisory**: Warns when separate `/tv`, `/movies`, etc. mounts prevent hardlinks and instant moves

### Input Handling

Accepts multiple input formats:

- Raw `docker-compose.yml` content
- Output from `docker compose config`
- Output from [`docker-autocompose`](https://github.com/Red5d/docker-autocompose) (strips shell prompts and non-YAML lines)

### Customizable Patterns

The Advanced Settings panel allows custom sensitive patterns (regex) and safe key lists. Configuration persists in `localStorage`.

## Self-Hosting

Download `docker-compose-debugger.html` from the [latest release](https://github.com/baker-scripts/docker-compose-debugger/releases/latest) and open it in any browser. Everything runs client-side in a single HTML file — no server, no network requests, no data leaves your browser.

## Development

```bash
npm install
npm run dev        # Start Vite dev server
npm test           # Run tests (vitest)
npm run build      # Build single-file dist/index.html
```

### Architecture

Single-page app built with Vite + vanilla TypeScript. The build produces one self-contained HTML file via `vite-plugin-singlefile`.

```
src/
  dom.ts            # Shared el() DOM helper (no innerHTML)
  patterns.ts       # Key + value regex patterns, type guards, helpers
  extract.ts        # Extracts YAML from mixed console output
  redact.ts         # Redacts sensitive values, anonymizes paths
  noise.ts          # Strips auto-generated noise fields
  advisories.ts     # Detects misconfigurations (hardlinks, etc.)
  services.ts       # Parses compose object into ServiceInfo[] + UserGroupInfo
  markdown.ts       # GitHub + Discord markdown generators
  cards.ts          # Renders per-service card DOM
  volume-table.ts   # Service / User-Group / Volume comparison tables
  volume-utils.ts   # Volume parsing + matrix builder
  config.ts         # Customizable patterns, localStorage persistence
  clipboard.ts      # Copy (with execCommand fallback), PrivateBin, Gist
  disclaimer.ts     # PII warnings and legal disclaimers
  main.ts           # UI assembly, tabs, and event wiring
```

### Testing

```bash
npm test                       # Run tests
npx vitest run --coverage      # Run with coverage report
```

## Privacy

- All processing happens in your browser — no data is sent anywhere
- No analytics, tracking, or external requests
- The "Open PrivateBin" and "Open GitHub Gist" buttons copy to clipboard and open a new tab — you paste manually

## Contributors

<a href="https://github.com/baker-scripts/docker-compose-debugger/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=baker-scripts/docker-compose-debugger" alt="Contributors" />
</a>

## Disclaimer

This tool is provided as-is with no warranty. While all processing happens client-side, always verify redaction output before sharing. The authors are not responsible for any accidentally exposed secrets.

## License

MIT

