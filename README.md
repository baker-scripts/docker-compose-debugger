# Docker Compose Debugger

[![CI](https://github.com/baker-scripts/docker-compose-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/baker-scripts/docker-compose-debugger/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/baker-scripts/docker-compose-debugger)](https://github.com/baker-scripts/docker-compose-debugger/releases/latest)

Browser tool that turns Docker Compose output into a sanitized, readable view for support channels. Paste `docker-autocompose` output, `docker compose config` output, or a raw `docker-compose.yml`. You get redacted YAML, per-service cards, User/Group and volume comparison tables, and markdown ready for GitHub or Discord.

Everything runs client-side. No data leaves your browser.

## Quick Start

1. Open [baker-scripts.github.io/docker-compose-debugger](https://baker-scripts.github.io/docker-compose-debugger/).
2. Generate the input. The page suggests this command:

   ```bash
   docker run --rm -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/red5d/docker-autocompose <container_name>
   ```

   You can also paste `docker compose config` output or a `docker-compose.yml` directly (512 KB maximum).
3. Click Sanitize.
4. Check the output, then use Copy MD (GitHub), Copy MD (Discord), or Copy to Clipboard.

To self-host, download `docker-compose-debugger.html` from the [latest release](https://github.com/baker-scripts/docker-compose-debugger/releases/latest) and open it in any browser. It is a single HTML file and needs no server.

## Configuration

Open Advanced Settings in the page to edit the redaction rules. Settings persist in browser `localStorage` (key `compose-sanitizer-config`).

| Setting | Format | Default |
|---------|--------|---------|
| Sensitive patterns | One regex per line, matched against env keys | Built-in list (passwords, secrets, tokens, API keys, auth, credentials, URL/DSN keys, webhooks, chat-platform IDs) |
| Safe keys | One key per line, never redacted | `PUID`, `PGID`, `TZ`, `UMASK`, `UMASK_SET`, `HOME`, `PATH`, `LANG`, `LC_ALL`, `LOG_LEVEL`, `WEBUI_PORT` |

Save Settings applies changes. Reset to Defaults restores the built-in lists.

## Usage

### Views

- Table (default): service overview, User/Group comparison, and Volume comparison. Best for spotting UID/GID mismatches or which services share which host paths.
- Cards: per-service view showing image, ports, volumes, networks, environment, and extras (user, restart policy, hostname, depends_on, resource limits). Empty sections are omitted.
- YAML: full sanitized YAML output, ready to paste into a gist.

### Copy as markdown

Two buttons:

- Copy MD (GitHub): `### heading` plus bare pipe-table markdown. Renders as a real table on GitHub.
- Copy MD (Discord): `**bold**` labels, with each table wrapped in a fenced code block. Discord doesn't render pipe tables, so the fence preserves alignment in monospace and prevents `_underscore_` / `*asterisk*` characters in volume paths from triggering inline formatting.

Both formats include the Services overview, User/Group comparison, and Volume comparison sections.

### Share buttons

Open PrivateBin, Open logs.notifiarr.com, and Open GitHub Gist copy the output to the clipboard and open the site in a new tab. You paste manually. For PrivateBin, set the expiry to 1 week or longer so support can review it.

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

Safe-listed keys are kept as-is (see Configuration).

### Noise stripping

Removes auto-generated fields that clutter compose output:

- `com.docker.compose.*` labels
- S6-overlay env vars (`S6_*`)
- Default runtime values (`ipc: private`, `entrypoint: /init`)
- Locale/path env vars (`PATH`, `LANG`, `XDG_*`)
- Empty env values and empty maps/arrays

### Advisories

Detects common misconfigurations and shows warnings with links to documentation:

- Hardlinks: warns when separate `/tv`, `/movies`, etc. mounts prevent hardlinks and instant moves

### Input handling

Accepts raw `docker-compose.yml` content, `docker compose config` output, and [`docker-autocompose`](https://github.com/Red5d/docker-autocompose) output (shell prompts and non-YAML lines are stripped).

## Development

```bash
npm install
npm run dev        # Vite dev server
npm test           # vitest
npm run build      # type-check, then build single-file dist/index.html
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

Coverage: `npm run test:coverage`.

## Privacy

- All processing happens in your browser. No analytics, tracking, or external requests.
- Review the output before sharing. Redaction is pattern-based and can miss values.

## Contributing

Issues and pull requests welcome. See the [contributing guidelines](https://github.com/baker-scripts/.github/blob/main/CONTRIBUTING.md); [open an issue](https://github.com/baker-scripts/docker-compose-debugger/issues) to discuss larger changes.

## Contributors

<a href="https://github.com/baker-scripts/docker-compose-debugger/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=baker-scripts/docker-compose-debugger" alt="Contributors" />
</a>

## Disclaimer

This tool is provided as-is with no warranty. While all processing happens client-side, always verify redaction output before sharing. The authors are not responsible for any accidentally exposed secrets.

## License

[MIT](LICENSE)
