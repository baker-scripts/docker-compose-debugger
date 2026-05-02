import { buildVolumeMatrix } from './volume-utils'
import type { ServiceInfo } from './services'

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function joinField(values: readonly string[]): string {
  return values.join(', ')
}

export function generateUserGroupComparisonMarkdown(services: readonly ServiceInfo[]): string {
  if (services.length === 0) return ''

  const dash = '—'
  type Row = { label: string; cells: string[] }
  const rows: Row[] = [
    { label: 'user:', cells: services.map(s => s.userGroup.user || dash) },
    { label: 'PUID', cells: services.map(s => s.userGroup.puid || dash) },
    { label: 'PGID', cells: services.map(s => s.userGroup.pgid || dash) },
    {
      label: 'group_add',
      cells: services.map(s => (s.userGroup.groupAdd.length > 0 ? s.userGroup.groupAdd.join(', ') : dash)),
    },
    { label: 'UMASK', cells: services.map(s => s.userGroup.umask || dash) },
  ]
  const visible = rows.filter(r => r.cells.some(c => c !== dash))
  if (visible.length === 0) return ''

  const header = `| User / Group | ${services.map(s => escapeCell(s.name)).join(' | ')} |`
  const separator = `| --- | ${services.map(() => '---').join(' | ')} |`
  const body = visible.map(r => `| ${r.label} | ${r.cells.map(escapeCell).join(' | ')} |`)

  return [header, separator, ...body].join('\n')
}

export function generateVolumeComparisonMarkdown(services: readonly ServiceInfo[]): string {
  if (services.length === 0) return ''

  const { hostPaths, matrix } = buildVolumeMatrix(services)
  if (hostPaths.length === 0) return ''

  const header = `| Host Path | ${services.map(s => escapeCell(s.name)).join(' | ')} |`
  const separator = `| --- | ${services.map(() => '---').join(' | ')} |`

  const rows = hostPaths.map(hp => {
    const serviceMap = matrix.get(hp) ?? new Map()
    const cells = services.map(svc => {
      const mapping = serviceMap.get(svc.name)
      if (!mapping) return '\u2014'
      const cell = mapping.mode ? `${mapping.target} (${mapping.mode})` : mapping.target
      return escapeCell(cell)
    })
    return `| ${escapeCell(hp)} | ${cells.join(' | ')} |`
  })

  return [header, separator, ...rows].join('\n')
}

export interface CombinedMarkdown {
  readonly serviceTable: string
  readonly userGroupTable: string
  readonly volumeTable: string
}

export function buildCombinedMarkdown(services: readonly ServiceInfo[]): CombinedMarkdown {
  return {
    serviceTable: generateMarkdownTable(services),
    userGroupTable: generateUserGroupComparisonMarkdown(services),
    volumeTable: generateVolumeComparisonMarkdown(services),
  }
}

export function formatForGitHub(parts: CombinedMarkdown): string {
  const out: string[] = []
  if (parts.serviceTable) out.push('### Services\n\n' + parts.serviceTable)
  if (parts.userGroupTable) out.push('### User / Group\n\n' + parts.userGroupTable)
  if (parts.volumeTable) out.push('### Volume Comparison\n\n' + parts.volumeTable)
  return out.join('\n\n')
}

// Discord renders pipe-table markdown as literal text and parses _underscores_,
// **asterisks**, and ~~tildes~~ inside paths. Wrapping each table in a fenced
// code block preserves alignment and blocks Discord's inline formatting.
export function formatForDiscord(parts: CombinedMarkdown): string {
  const out: string[] = []
  if (parts.serviceTable) {
    out.push('**Services**\n```\n' + parts.serviceTable + '\n```')
  }
  if (parts.userGroupTable) {
    out.push('**User / Group**\n```\n' + parts.userGroupTable + '\n```')
  }
  if (parts.volumeTable) {
    out.push('**Volume Comparison**\n```\n' + parts.volumeTable + '\n```')
  }
  return out.join('\n\n')
}

export function generateMarkdownTable(services: readonly ServiceInfo[]): string {
  if (services.length === 0) return ''

  // Collect extra keys across all services
  const extraKeys: string[] = []
  const seen = new Set<string>()
  for (const svc of services) {
    for (const key of svc.extras.keys()) {
      if (!seen.has(key)) {
        seen.add(key)
        extraKeys.push(key)
      }
    }
  }

  const columns = ['Service', 'Image', 'Ports', 'Networks', ...extraKeys]
  const header = `| ${columns.join(' | ')} |`
  const separator = `| ${columns.map(() => '---').join(' | ')} |`

  const rows = services.map(svc => {
    const baseCells = [
      escapeCell(svc.name),
      escapeCell(svc.image),
      escapeCell(joinField([...svc.ports])),
      escapeCell(joinField(svc.networks.map(n => n.name))),
    ]
    const extraCells = extraKeys.map(key => escapeCell(svc.extras.get(key) ?? ''))
    return `| ${[...baseCells, ...extraCells].join(' | ')} |`
  })

  return [header, separator, ...rows].join('\n')
}
