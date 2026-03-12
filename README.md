# Docker Compose Debugger

Browser-based tool that turns messy Docker Compose output into clean, readable debugging views. Paste output from `docker-autocompose`, `docker compose config`, or raw `docker-compose.yml` — get sanitized YAML with sensitive values redacted, per-service cards, volume comparison tables, and a markdown table ready for Discord or GitHub support channels.

**Live:** [baker-scripts.github.io/docker-compose-debugger](https://baker-scripts.github.io/docker-compose-debugger/)

## Features

### Service Cards

Parsed per-service view showing image, ports, volumes, networks, environment, and extras (restart policy, hostname, depends_on, resource limits). Empty sections are omitted. Switch between YAML and Cards views with the tab bar.

### Markdown Table

One-click "Copy as Markdown Table" generates a table with columns for Service, Image, Ports, Volumes, and Networks — paste directly into Discord or GitHub issues.

### Redaction

| What | Example | Result |
|------|---------|--------|
| Sensitive env values | `RADARR__POSTGRES__HOST: db.example.com` | `RADARR__POSTGRES__HOST: **REDACTED**` |
| Email addresses | `NOTIFY: user@example.com` | `NOTIFY: **REDACTED**` |
| Home directory paths | `/home/john/media:/tv` | `~/media:/tv` |

Detected patterns: `password`, `secret`, `token`, `api_key`, `auth`, `credential`, `private_key`, `vpn_user`, and more.

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
  dom.ts          # Shared el() DOM helper (no innerHTML)
  patterns.ts     # Type guards, regex patterns, utility functions
  extract.ts      # Extracts YAML from mixed console output
  redact.ts       # Redacts sensitive values, anonymizes paths
  noise.ts        # Strips auto-generated noise fields
  advisories.ts   # Detects misconfigurations (hardlinks, etc.)
  services.ts     # Parses compose object into ServiceInfo[]
  markdown.ts     # Generates markdown table from ServiceInfo[]
  cards.ts        # Renders per-service card DOM
  config.ts       # Customizable patterns, localStorage persistence
  clipboard.ts    # Copy, PrivateBin, and Gist sharing
  disclaimer.ts   # PII warnings and legal disclaimers
  main.ts         # UI assembly, tabs, and event wiring
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
