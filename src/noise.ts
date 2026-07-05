import { isRecord } from './patterns'

const COMPOSE_LABEL_PREFIX = 'com.docker.compose.'

const NOISE_ENV_PATTERNS: readonly RegExp[] = [
  /^S6_/i,
  /^IMAGE_STATS$/i,
  /^APP_DIR$/i,
  /^CONFIG_DIR$/i,
  /^XDG_/i,
  /^LANG$/i,
  /^LANGUAGE$/i,
  /^LC_ALL$/i,
  /^PATH$/i,
  /^PRIVOXY_ENABLED$/i,
  /^UNBOUND_ENABLED$/i,
]

const DEFAULT_SERVICE_FIELDS: ReadonlyMap<string, unknown> = new Map([
  ['ipc', 'private'],
  ['working_dir', '/'],
])

const DEFAULT_ENTRYPOINTS = new Set(['/init'])

function isEmpty(value: unknown): boolean {
  if (value == null) return true
  if (value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (isRecord(value) && Object.keys(value).length === 0) return true
  return false
}

function isNoiseEnvKey(key: string): boolean {
  return NOISE_ENV_PATTERNS.some(p => p.test(key))
}

function isEmptyEnvValue(entry: string): boolean {
  const eqIdx = entry.indexOf('=')
  if (eqIdx === -1) return false
  return entry.slice(eqIdx + 1) === ''
}

function stripComposeLabelsDict(labels: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(labels)) {
    if (!key.startsWith(COMPOSE_LABEL_PREFIX)) {
      result[key] = value
    }
  }
  return result
}

function stripComposeLabelsArray(labels: readonly unknown[]): readonly unknown[] {
  return labels.filter(item => {
    const str = String(item)
    return !str.startsWith(COMPOSE_LABEL_PREFIX)
  })
}

function stripNoiseEnvDict(env: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(env)) {
    if (!isNoiseEnvKey(key)) {
      const strValue = value == null ? '' : String(value)
      if (strValue !== '') {
        result[key] = value
      }
    }
  }
  return result
}

function stripNoiseEnvArray(env: readonly unknown[]): readonly unknown[] {
  return env.filter(item => {
    const str = String(item)
    const eqIdx = str.indexOf('=')
    const key = eqIdx >= 0 ? str.slice(0, eqIdx) : str
    if (isNoiseEnvKey(key)) return false
    if (isEmptyEnvValue(str)) return false
    return true
  })
}

function isDefaultEntrypoint(entrypoint: unknown): boolean {
  if (Array.isArray(entrypoint) && entrypoint.length === 1) {
    return DEFAULT_ENTRYPOINTS.has(String(entrypoint[0]))
  }
  if (typeof entrypoint === 'string') {
    return DEFAULT_ENTRYPOINTS.has(entrypoint)
  }
  return false
}

function isDefaultOnlyNetwork(networks: Record<string, unknown>): boolean {
  const keys = Object.keys(networks)
  if (keys.length !== 1 || keys[0] !== 'default') return false
  const defaultNet = networks['default']
  if (defaultNet == null) return true
  if (!isRecord(defaultNet)) return false
  const entries = Object.entries(defaultNet).filter(([, v]) => v != null && v !== false)
  return entries.length === 0
}

function cleanFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (!isEmpty(value)) {
      result[key] = value
    }
  }
  return result
}

function stripServiceNoise(service: Record<string, unknown>): Record<string, unknown> {
  let result: Record<string, unknown> = { ...service }

  // Strip compose labels
  const labels = service['labels']
  if (isRecord(labels)) {
    result = { ...result, labels: stripComposeLabelsDict(labels) }
  } else if (Array.isArray(labels)) {
    result = { ...result, labels: stripComposeLabelsArray(labels) }
  }

  // Strip noise env vars
  const env = service['environment']
  if (isRecord(env)) {
    result = { ...result, environment: stripNoiseEnvDict(env) }
  } else if (Array.isArray(env)) {
    result = { ...result, environment: stripNoiseEnvArray(env) }
  }

  // Strip default Docker fields
  for (const [field, defaultValue] of DEFAULT_SERVICE_FIELDS) {
    if (result[field] === defaultValue) {
      const { [field]: _, ...rest } = result
      result = rest
    }
  }

  // Strip default entrypoint
  if (isDefaultEntrypoint(result['entrypoint'])) {
    const { entrypoint: _, ...rest } = result
    result = rest
  }

  return cleanFields(result)
}

export function stripNoise(compose: Record<string, unknown>): Record<string, unknown> {
  let result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(compose)) {
    if (key === 'version' || key === 'name') continue
    result[key] = value
  }

  const services = result['services']
  if (isRecord(services)) {
    const newServices: Record<string, unknown> = {}
    for (const [name, svc] of Object.entries(services)) {
      newServices[name] = isRecord(svc) ? stripServiceNoise(svc) : svc
    }
    result = { ...result, services: newServices }
  }

  const networks = result['networks']
  if (isRecord(networks) && isDefaultOnlyNetwork(networks)) {
    const { networks: _, ...rest } = result
    result = rest
  }

  const volumes = result['volumes']
  if (isRecord(volumes) && Object.keys(volumes).length === 0) {
    const { volumes: _, ...rest } = result
    result = rest
  }

  return result
}
