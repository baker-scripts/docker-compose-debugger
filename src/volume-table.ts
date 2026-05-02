import { el } from './dom'
import { buildVolumeMatrix, type VolumeMapping } from './volume-utils'
import type { ServiceInfo, UserGroupInfo } from './services'

const EM_DASH = '—'

interface UserGroupRow {
  readonly label: string
  readonly cells: readonly string[]
}

function userGroupRows(services: readonly ServiceInfo[]): readonly UserGroupRow[] {
  const cell = (svc: ServiceInfo, fn: (ug: UserGroupInfo) => string): string => {
    const v = fn(svc.userGroup)
    return v === '' ? EM_DASH : v
  }
  const rows: UserGroupRow[] = [
    { label: 'user:', cells: services.map(s => cell(s, ug => ug.user)) },
    { label: 'PUID', cells: services.map(s => cell(s, ug => ug.puid)) },
    { label: 'PGID', cells: services.map(s => cell(s, ug => ug.pgid)) },
    { label: 'group_add', cells: services.map(s => cell(s, ug => ug.groupAdd.join(', '))) },
    { label: 'UMASK', cells: services.map(s => cell(s, ug => ug.umask)) },
  ]
  // Hide rows where every service has em-dash (nothing to compare).
  return rows.filter(r => r.cells.some(c => c !== EM_DASH))
}

export function renderUserGroupTable(services: readonly ServiceInfo[]): HTMLElement {
  const wrap = el('div', { className: 'volume-table-wrap' })
  if (services.length === 0) return wrap

  const rows = userGroupRows(services)
  if (rows.length === 0) return wrap

  const table = el('table', { className: 'volume-table' })

  const thead = el('thead')
  const headerRow = el('tr')
  const propTh = el('th')
  propTh.textContent = 'User / Group'
  headerRow.appendChild(propTh)
  for (const svc of services) {
    const th = el('th')
    th.textContent = svc.name
    headerRow.appendChild(th)
  }
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = el('tbody')
  for (const row of rows) {
    const tr = el('tr')
    const labelTd = el('td')
    labelTd.textContent = row.label
    labelTd.style.fontWeight = '600'
    tr.appendChild(labelTd)
    for (const value of row.cells) {
      const td = el('td')
      td.textContent = value
      if (value === EM_DASH) td.className = 'vol-empty'
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)

  wrap.appendChild(table)
  return wrap
}

function formatCell(mapping: VolumeMapping): string {
  return mapping.mode ? `${mapping.target} (${mapping.mode})` : mapping.target
}

export function renderServiceTable(services: readonly ServiceInfo[]): HTMLElement {
  const wrap = el('div', { className: 'volume-table-wrap' })
  if (services.length === 0) return wrap

  const table = el('table', { className: 'volume-table' })

  // Determine which extra keys exist across all services
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

  // Header
  const thead = el('thead')
  const headerRow = el('tr')
  const columns = ['Service', 'Image', 'Ports', 'Networks', ...extraKeys]
  for (const col of columns) {
    const th = el('th')
    th.textContent = col
    headerRow.appendChild(th)
  }
  thead.appendChild(headerRow)
  table.appendChild(thead)

  // Body
  const tbody = el('tbody')
  for (const svc of services) {
    const row = el('tr')

    const nameTd = el('td')
    nameTd.textContent = svc.name
    nameTd.style.color = 'var(--primary)'
    nameTd.style.fontWeight = '600'
    row.appendChild(nameTd)

    const imageTd = el('td')
    imageTd.textContent = svc.image
    row.appendChild(imageTd)

    const portsTd = el('td')
    portsTd.textContent = svc.ports.length > 0 ? [...svc.ports].join(', ') : '\u2014'
    if (svc.ports.length === 0) portsTd.className = 'vol-empty'
    row.appendChild(portsTd)

    const netTd = el('td')
    const netNames = svc.networks.map(n => n.name)
    netTd.textContent = netNames.length > 0 ? netNames.join(', ') : '\u2014'
    if (svc.networks.length === 0) netTd.className = 'vol-empty'
    row.appendChild(netTd)

    for (const key of extraKeys) {
      const td = el('td')
      const val = svc.extras.get(key)
      if (val) {
        td.textContent = val
      } else {
        td.textContent = '\u2014'
        td.className = 'vol-empty'
      }
      row.appendChild(td)
    }

    tbody.appendChild(row)
  }
  table.appendChild(tbody)

  wrap.appendChild(table)
  return wrap
}

export function renderVolumeTable(services: readonly ServiceInfo[]): HTMLElement {
  const wrap = el('div', { className: 'volume-table-wrap' })

  const { hostPaths, matrix } = buildVolumeMatrix(services)
  if (hostPaths.length === 0) return wrap

  const table = el('table', { className: 'volume-table' })

  // Header
  const thead = el('thead')
  const headerRow = el('tr')
  const hostTh = el('th')
  hostTh.textContent = 'Host Path'
  headerRow.appendChild(hostTh)
  for (const svc of services) {
    const th = el('th')
    th.textContent = svc.name
    headerRow.appendChild(th)
  }
  thead.appendChild(headerRow)
  table.appendChild(thead)

  // Body
  const tbody = el('tbody')
  for (const hostPath of hostPaths) {
    const row = el('tr')

    const pathTd = el('td')
    pathTd.textContent = hostPath
    row.appendChild(pathTd)

    const serviceMap = matrix.get(hostPath)
    for (const svc of services) {
      const mapping = serviceMap?.get(svc.name)
      const td = el('td')
      if (mapping) {
        td.textContent = formatCell(mapping)
      } else {
        td.textContent = '\u2014'
        td.className = 'vol-empty'
      }
      row.appendChild(td)
    }

    tbody.appendChild(row)
  }
  table.appendChild(tbody)

  wrap.appendChild(table)
  return wrap
}
