import { describe, it, expect } from 'vitest'
import { renderServiceTable, renderVolumeTable } from '../src/volume-table'
import type { ServiceInfo, NetworkInfo } from '../src/services'

function net(name: string, opts?: { aliases?: string[]; ipv4Address?: string }): NetworkInfo {
  return { name, aliases: opts?.aliases ?? [], ipv4Address: opts?.ipv4Address ?? '' }
}

function makeService(overrides: Partial<ServiceInfo> & { name: string }): ServiceInfo {
  return {
    image: '',
    ports: [],
    volumes: [],
    networks: [],
    environment: new Map(),
    extras: new Map(),
    userGroup: { user: '', puid: '', pgid: '', groupAdd: [], umask: '' },
    ...overrides,
  }
}

describe('renderServiceTable', () => {
  it('returns empty wrapper for no services', () => {
    const container = renderServiceTable([])
    expect(container.querySelector('table')).toBeNull()
  })

  it('renders base columns: Service, Image, Ports, Networks', () => {
    const services = [
      makeService({ name: 'app', image: 'nginx:latest', ports: ['80:80'], networks: [net('frontend')] }),
    ]
    const container = renderServiceTable(services)
    const ths = container.querySelectorAll('th')
    expect(ths[0]!.textContent).toBe('Service')
    expect(ths[1]!.textContent).toBe('Image')
    expect(ths[2]!.textContent).toBe('Ports')
    expect(ths[3]!.textContent).toBe('Networks')
  })

  it('renders service data in rows', () => {
    const services = [
      makeService({ name: 'plex', image: 'plex:latest', ports: ['32400:32400'], networks: [net('media')] }),
    ]
    const container = renderServiceTable(services)
    const tds = container.querySelectorAll('tbody td')
    expect(tds[0]!.textContent).toBe('plex')
    expect(tds[1]!.textContent).toBe('plex:latest')
    expect(tds[2]!.textContent).toBe('32400:32400')
    expect(tds[3]!.textContent).toBe('media')
  })

  it('shows dash for empty ports and networks', () => {
    const services = [makeService({ name: 'app', image: 'nginx' })]
    const container = renderServiceTable(services)
    const tds = container.querySelectorAll('tbody td')
    expect(tds[2]!.textContent).toBe('\u2014')
    expect(tds[3]!.textContent).toBe('\u2014')
  })

  it('includes extras as dynamic columns', () => {
    const services = [
      makeService({ name: 'app', image: 'nginx', extras: new Map([['restart', 'unless-stopped']]) }),
      makeService({ name: 'db', image: 'postgres', extras: new Map([['restart', 'always'], ['hostname', 'pg-host']]) }),
    ]
    const container = renderServiceTable(services)
    const ths = container.querySelectorAll('th')
    const headers = Array.from(ths).map(th => th.textContent)
    expect(headers).toContain('restart')
    expect(headers).toContain('hostname')

    // app row: has restart, no hostname
    const rows = container.querySelectorAll('tbody tr')
    const appCells = rows[0]!.querySelectorAll('td')
    const restartIdx = headers.indexOf('restart')
    const hostnameIdx = headers.indexOf('hostname')
    expect(appCells[restartIdx]!.textContent).toBe('unless-stopped')
    expect(appCells[hostnameIdx]!.textContent).toBe('\u2014')

    // db row: has both
    const dbCells = rows[1]!.querySelectorAll('td')
    expect(dbCells[restartIdx]!.textContent).toBe('always')
    expect(dbCells[hostnameIdx]!.textContent).toBe('pg-host')
  })

  it('renders only network name, not aliases or ip', () => {
    const services = [
      makeService({
        name: 'app',
        image: 'nginx',
        networks: [net('media', { aliases: ['plex-alias'], ipv4Address: '172.20.0.5' })],
      }),
    ]
    const container = renderServiceTable(services)
    const tds = container.querySelectorAll('tbody td')
    // Networks column is index 3 (Service, Image, Ports, Networks)
    expect(tds[3]!.textContent).toBe('media')
  })
})

describe('renderVolumeTable', () => {
  it('returns empty div for no services', () => {
    const table = renderVolumeTable([])
    expect(table.querySelector('table')).toBeNull()
  })

  it('returns empty div for services with no volumes', () => {
    const services = [makeService({ name: 'app', image: 'nginx' })]
    const table = renderVolumeTable(services)
    expect(table.querySelector('table')).toBeNull()
  })

  it('renders a table with host path rows and service columns', () => {
    const services = [
      makeService({ name: 'plex', image: 'plex', volumes: ['/config:/config', '/mnt/data/media:/data'] }),
      makeService({ name: 'radarr', image: 'radarr', volumes: ['/config:/config', '/mnt/data/usenet:/data/usenet'] }),
    ]
    const container = renderVolumeTable(services)
    const table = container.querySelector('table')
    expect(table).not.toBeNull()

    // Header: Host Path | plex | radarr
    const ths = table!.querySelectorAll('th')
    expect(ths).toHaveLength(3)
    expect(ths[0]!.textContent).toBe('Host Path')
    expect(ths[1]!.textContent).toBe('plex')
    expect(ths[2]!.textContent).toBe('radarr')
  })

  it('sorts host paths alphabetically', () => {
    const services = [
      makeService({ name: 'app', image: 'img', volumes: ['/z:/z', '/a:/a', '/m:/m'] }),
    ]
    const container = renderVolumeTable(services)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows[0]!.querySelector('td')!.textContent).toBe('/a')
    expect(rows[1]!.querySelector('td')!.textContent).toBe('/m')
    expect(rows[2]!.querySelector('td')!.textContent).toBe('/z')
  })

  it('shows dash for services that do not mount a host path', () => {
    const services = [
      makeService({ name: 'plex', image: 'plex', volumes: ['/config:/config'] }),
      makeService({ name: 'radarr', image: 'radarr', volumes: ['/data:/data'] }),
    ]
    const container = renderVolumeTable(services)
    const rows = container.querySelectorAll('tbody tr')

    // /config row: plex has it, radarr doesn't
    const configCells = rows[0]!.querySelectorAll('td')
    expect(configCells[0]!.textContent).toBe('/config')
    expect(configCells[1]!.textContent).toBe('/config')
    expect(configCells[2]!.textContent).toBe('\u2014')

    // /data row: plex doesn't have it, radarr does
    const dataCells = rows[1]!.querySelectorAll('td')
    expect(dataCells[0]!.textContent).toBe('/data')
    expect(dataCells[1]!.textContent).toBe('\u2014')
    expect(dataCells[2]!.textContent).toBe('/data')
  })

  it('includes mode in cell when present', () => {
    const services = [
      makeService({ name: 'app', image: 'img', volumes: ['/data:/data:ro'] }),
    ]
    const container = renderVolumeTable(services)
    const cell = container.querySelectorAll('tbody td')[1]
    expect(cell!.textContent).toBe('/data (ro)')
  })

  it('handles single service with multiple volumes', () => {
    const services = [
      makeService({ name: 'app', image: 'img', volumes: ['/a:/x', '/b:/y:ro'] }),
    ]
    const container = renderVolumeTable(services)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(2)
  })

  it('deduplicates host paths across services', () => {
    const services = [
      makeService({ name: 'a', image: 'img', volumes: ['/shared:/data'] }),
      makeService({ name: 'b', image: 'img', volumes: ['/shared:/media:ro'] }),
    ]
    const container = renderVolumeTable(services)
    const rows = container.querySelectorAll('tbody tr')
    // Only one row for /shared
    expect(rows).toHaveLength(1)
    const cells = rows[0]!.querySelectorAll('td')
    expect(cells[0]!.textContent).toBe('/shared')
    expect(cells[1]!.textContent).toBe('/data')
    expect(cells[2]!.textContent).toBe('/media (ro)')
  })
})
