export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const DEFAULT_SENSITIVE_PATTERNS: readonly RegExp[] = [
  /passw(or)?d/i,
  /^pw$/i,
  /[_.]pass(w)?$/i,
  /^pass[_.]?/i,
  /secret/i,
  /token/i,
  /api[_\-.:]?key/i,
  /auth/i,
  /credential/i,
  /private[_\-.]?key/i,
  /vpn[_\-.]?user/i,
  // Connection strings & DSN-style keys often contain inline credentials.
  /[_.\-](url|uri|dsn|conn(?:ection)?(?:_string)?)$/i,
  /^(database|redis|mongo|amqp|rabbit|celery|postgres|mysql|elastic)[_.\-]?(url|uri|dsn)?$/i,
  // Cloud / vendor keys.
  /aws[_\-.]?(access|secret)[_\-.]?key/i,
  /tailscale[_\-.]?(auth)?[_\-.]?key/i,
  /webhook/i,
  /pat$/i,
  /^gh[_\-.]?(token|pat)/i,
  // Discord / Slack / generic chat-platform identifiers. Snowflake IDs and
  // channel/guild identifiers leak who the user is and which servers they
  // are in; treat them as sensitive. (Issue #10, requested by TRaSH.)
  /^(discord|slack|telegram|matrix|teams)[_\-.]/i,
  /\b(guild|channel|server|workspace|tenant|application|bot|client)[_\-.]?id$/i,
]

export const DEFAULT_SAFE_KEYS: ReadonlySet<string> = new Set([
  'PUID', 'PGID', 'TZ', 'UMASK', 'UMASK_SET',
  'HOME', 'PATH', 'LANG', 'LC_ALL',
  'LOG_LEVEL', 'WEBUI_PORT',
])

export const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/

export const HOME_DIR_PATTERN = /^(\/home\/[^/]+|~|\/root)\//

// Value-side patterns: trigger redaction even when the key looks innocent.
// Catches credentials embedded in URLs and provider-specific token formats.
// pragma: allowlist secret
export const SENSITIVE_VALUE_PATTERNS: readonly RegExp[] = [
  // Basic-auth credentials embedded in any URL (scheme then user:pass@host).
  /[a-z][a-z0-9+\-.]{1,20}:\/\/[^\s/@:]{1,200}:[^\s/@]{1,200}@/i,  // pragma: allowlist secret
  // GitHub classic PATs: ghp_, gho_, ghu_, ghs_, ghr_
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  // GitHub fine-grained PATs: github_pat_<base62/underscore>
  /\bgithub_pat_[A-Za-z0-9_]{60,}\b/,
  // AWS access key IDs (AKIA, ASIA, AROA, AIPA, AGPA, AIDA prefixes)
  /\b(?:AKIA|ASIA|AROA|AIPA|AGPA|AIDA)[A-Z0-9]{16}\b/,
  // Tailscale auth keys
  /\btskey-[a-z]+-[A-Za-z0-9-]+\b/,
  // Discord webhook URLs
  /https:\/\/(?:discord(?:app)?\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+/i,
  // Slack incoming webhooks
  /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/,
  // JWT (three base64url segments separated by dots, "ey…"-prefixed first segment)
  /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
]

// Strip a trailing _FILE suffix (Docker-secrets convention) so that keys like
// DATABASE_URL_FILE or POSTGRES_PASSWORD_FILE match the same patterns as their
// non-_FILE counterparts.
function stripFileSuffix(key: string): string {
  return key.replace(/_FILE$/i, '')
}

export function isSensitiveKey(
  key: string,
  sensitivePatterns?: readonly RegExp[],
  safeKeys?: ReadonlySet<string>,
): boolean {
  const safe = safeKeys ?? DEFAULT_SAFE_KEYS
  const sensitive = sensitivePatterns ?? DEFAULT_SENSITIVE_PATTERNS
  const stripped = stripFileSuffix(key)
  if (safe.has(stripped.toUpperCase())) return false
  return sensitive.some(p => p.test(stripped))
}

export function containsEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value)
}

export function containsSensitiveValue(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some(p => p.test(value))
}

export function anonymizeHomePath(volumeStr: string): string {
  return volumeStr.replace(HOME_DIR_PATTERN, '~/')
}
