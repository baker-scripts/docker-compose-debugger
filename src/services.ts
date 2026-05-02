import { isRecord } from './patterns'

export interface NetworkInfo {
  readonly name: string
  readonly aliases: readonly string[]
  readonly ipv4Address: string
}

export interface UserGroupInfo {
  readonly user: string         // explicit user: directive (UID[:GID]) or empty
  readonly puid: string          // PUID env value or empty
  readonly pgid: string          // PGID env value or empty
  readonly groupAdd: readonly string[]  // group_add entries
  readonly umask: string         // UMASK env value or empty
}

export interface ServiceInfo {
  readonly name: string
  readonly image: string
  readonly ports: readonly string[]
  readonly volumes: readonly string[]
  readonly networks: readonly NetworkInfo[]
  readonly environment: ReadonlyMap<string, string>
  readonly extras: ReadonlyMap<string, string>
  readonly userGroup: UserGroupInfo
}

function normalizePort(entry: unknown): string {
  if (typeof entry === 'string' || typeof entry === 'number') {
    return String(entry)
  }
  if (isRecord(entry)) {
    const target = entry['target'] ?? ''
    const published = entry['published'] ?? ''
    const protocol = typeof entry['protocol'] === 'string' ? entry['protocol'] : undefined
    const hostIp = typeof entry['host_ip'] === 'string' ? entry['host_ip'] : undefined
    const hostPart = hostIp ? `${hostIp}:${published}` : String(published)
    const base = `${hostPart}:${target}`
    return protocol ? `${base}/${protocol}` : base
  }
  return String(entry)
}

function normalizePorts(ports: unknown): readonly string[] {
  if (!Array.isArray(ports)) return []
  return ports.map(normalizePort)
}

function normalizeVolume(entry: unknown): string {
  if (typeof entry === 'string') return entry
  if (isRecord(entry)) {
    const source = entry['source'] ?? ''
    const target = entry['target'] ?? ''
    const readOnly = entry['read_only'] === true
    const base = `${source}:${target}`
    return readOnly ? `${base}:ro` : base
  }
  return String(entry)
}

function normalizeVolumes(volumes: unknown): readonly string[] {
  if (!Array.isArray(volumes)) return []
  return volumes.map(normalizeVolume)
}

function extractNetworks(networks: unknown): readonly NetworkInfo[] {
  if (Array.isArray(networks)) {
    return [...networks]
      .map(n => ({ name: String(n), aliases: [] as readonly string[], ipv4Address: '' }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  if (isRecord(networks)) {
    return Object.entries(networks)
      .map(([name, config]): NetworkInfo => {
        const aliases = isRecord(config) && Array.isArray(config['aliases'])
          ? config['aliases'].map(String)
          : []
        const ipv4Address = isRecord(config) && typeof config['ipv4_address'] === 'string'
          ? config['ipv4_address']
          : ''
        return { name, aliases, ipv4Address }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  return []
}

function extractEnvironment(env: unknown): ReadonlyMap<string, string> {
  const result = new Map<string, string>()
  if (isRecord(env)) {
    for (const [key, value] of Object.entries(env)) {
      result.set(key, String(value ?? ''))
    }
  } else if (Array.isArray(env)) {
    for (const entry of env) {
      const str = String(entry)
      const eqIdx = str.indexOf('=')
      if (eqIdx >= 0) {
        result.set(str.slice(0, eqIdx), str.slice(eqIdx + 1))
      } else {
        result.set(str, '')
      }
    }
  }
  return result
}

function formatResourceLimits(resources: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [section, value] of Object.entries(resources)) {
    if (isRecord(value)) {
      const fields = Object.entries(value).map(([k, v]) => `${k}=${v}`)
      if (fields.length > 0) {
        parts.push(`${section}: ${fields.join(', ')}`)
      }
    }
  }
  return parts.join('; ')
}

// Linuxserver env conventions are uppercase, but we look up case-insensitively
// so a typo'd `Puid` or `pgid` still surfaces in the User/Group comparison.
function envLookupCI(env: ReadonlyMap<string, string>, name: string): string {
  const direct = env.get(name)
  if (direct !== undefined) return direct.trim()
  const upper = name.toUpperCase()
  for (const [k, v] of env) {
    if (k.toUpperCase() === upper) return v.trim()
  }
  return ''
}

// Compose accepts user as either a quoted string ("1000:1000") or a bare YAML
// scalar (1000). js-yaml parses the bare form to a number, so coerce both.
function readUserDirective(service: Record<string, unknown>): string {
  const v = service['user']
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  return ''
}

function extractUserGroup(service: Record<string, unknown>, env: ReadonlyMap<string, string>): UserGroupInfo {
  const groupAddRaw = service['group_add']
  const groupAdd = Array.isArray(groupAddRaw) ? groupAddRaw.map(String) : []
  return {
    user: readUserDirective(service),
    puid: envLookupCI(env, 'PUID'),
    pgid: envLookupCI(env, 'PGID'),
    groupAdd,
    umask: envLookupCI(env, 'UMASK'),
  }
}

function deriveUser(service: Record<string, unknown>, env: ReadonlyMap<string, string>): string {
  const directive = readUserDirective(service)
  const puid = envLookupCI(env, 'PUID')
  const pgid = envLookupCI(env, 'PGID')

  // Prefer the explicit user: directive (it takes effect at runtime; PUID/PGID
  // are linuxserver convention only).
  if (directive && (puid || pgid)) {
    const envPart = puid && pgid ? `PUID=${puid} PGID=${pgid}` : puid ? `PUID=${puid}` : `PGID=${pgid}`
    // If directive matches PUID:PGID, surface a single value.
    if (directive === `${puid}:${pgid}`) return directive
    return `${directive} (${envPart})`
  }
  if (directive) return directive
  if (puid && pgid) return `${puid}:${pgid}`
  if (puid) return `PUID=${puid}`
  if (pgid) return `PGID=${pgid}`
  return ''
}

function extractExtras(service: Record<string, unknown>, env: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const extras = new Map<string, string>()

  const userField = deriveUser(service, env)
  if (userField) {
    extras.set('user', userField)
  }

  const simpleKeys = ['restart', 'hostname', 'container_name'] as const
  for (const key of simpleKeys) {
    const value = service[key]
    if (value != null && value !== '') {
      extras.set(key, String(value))
    }
  }

  const dependsOn = service['depends_on']
  if (Array.isArray(dependsOn)) {
    extras.set('depends_on', dependsOn.map(String).join(', '))
  } else if (isRecord(dependsOn)) {
    extras.set('depends_on', Object.keys(dependsOn).join(', '))
  }

  const deploy = service['deploy']
  if (isRecord(deploy)) {
    const resources = deploy['resources']
    if (isRecord(resources)) {
      const formatted = formatResourceLimits(resources)
      if (formatted) {
        extras.set('deploy.resources', formatted)
      }
    }
  }

  return extras
}

function parseService(name: string, service: Record<string, unknown>): ServiceInfo {
  const environment = extractEnvironment(service['environment'])
  return {
    name,
    image: typeof service['image'] === 'string' ? service['image'] : '',
    ports: normalizePorts(service['ports']),
    volumes: normalizeVolumes(service['volumes']),
    networks: extractNetworks(service['networks']),
    environment,
    extras: extractExtras(service, environment),
    userGroup: extractUserGroup(service, environment),
  }
}

export function parseServices(compose: Record<string, unknown>): readonly ServiceInfo[] {
  const services = compose['services']
  if (!isRecord(services)) return []

  const result: ServiceInfo[] = []
  for (const [name, svc] of Object.entries(services)) {
    if (isRecord(svc)) {
      result.push(parseService(name, svc))
    }
  }

  return [...result].sort((a, b) => a.name.localeCompare(b.name))
}
