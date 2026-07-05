export interface SanitizerConfig {
  readonly sensitivePatterns: readonly string[]
  readonly safeKeys: readonly string[]
}

const STORAGE_KEY = 'compose-sanitizer-config'

export const DEFAULT_CONFIG: SanitizerConfig = {
  sensitivePatterns: [
    'passw(or)?d',
    '^pw$',
    '[_.]pass(w)?$',
    '^pass[_.]?',
    'secret',
    'token',
    'api[_\\-.:]?key',
    'auth',
    'credential',
    'private[_\\-.]?key',
    'vpn[_\\-.]?user',
    '[_.\\-](url|uri|dsn|conn(?:ection)?(?:_string)?)$',
    '^(database|redis|mongo|amqp|rabbit|celery|postgres|mysql|elastic)[_.\\-]?(url|uri|dsn)?$',
    'aws[_\\-.]?(access|secret)[_\\-.]?key',
    'tailscale[_\\-.]?(auth)?[_\\-.]?key',
    'webhook',
    'pat$',
    '^gh[_\\-.]?(token|pat)',
    '^(discord|slack|telegram|matrix|teams)[_\\-.]',
    '\\b(guild|channel|server|workspace|tenant|application|bot|client)[_\\-.]?id$',
  ],
  safeKeys: [
    'PUID', 'PGID', 'TZ', 'UMASK', 'UMASK_SET',
    'HOME', 'PATH', 'LANG', 'LC_ALL',
    'LOG_LEVEL', 'WEBUI_PORT',
  ],
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(x => typeof x === 'string')
}

function isValidConfig(value: unknown): value is Partial<SanitizerConfig> {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (obj['sensitivePatterns'] !== undefined && !isStringArray(obj['sensitivePatterns'])) return false
  if (obj['safeKeys'] !== undefined && !isStringArray(obj['safeKeys'])) return false
  return true
}

export function compileConfig(config: SanitizerConfig): {
  readonly sensitivePatterns: readonly RegExp[]
  readonly safeKeys: ReadonlySet<string>
} {
  const compiled: RegExp[] = []
  for (const p of config.sensitivePatterns) {
    try {
      compiled.push(new RegExp(p, 'i'))
    } catch {
      // Skip invalid regex patterns — user entered bad syntax in settings
    }
  }
  return {
    sensitivePatterns: compiled,
    safeKeys: new Set(config.safeKeys.map(k => k.toUpperCase())),
  }
}

export function loadConfig(): SanitizerConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_CONFIG

    const parsed: unknown = JSON.parse(raw)
    if (!isValidConfig(parsed)) return DEFAULT_CONFIG

    return {
      sensitivePatterns: parsed.sensitivePatterns ?? DEFAULT_CONFIG.sensitivePatterns,
      safeKeys: parsed.safeKeys ?? DEFAULT_CONFIG.safeKeys,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveConfig(config: SanitizerConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function resetConfig(): SanitizerConfig {
  localStorage.removeItem(STORAGE_KEY)
  return DEFAULT_CONFIG
}
