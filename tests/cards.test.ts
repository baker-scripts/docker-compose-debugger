import { describe, it, expect } from 'vitest'
import { renderCards, parseVolume } from '../src/cards'
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

describe('renderCards', () => {
  it('returns a container with correct class', () => {
    const container = renderCards([])
    expect(container.className).toBe('cards-container')
  })

  it('renders no cards for empty array', () => {
    const container = renderCards([])
    expect(container.children).toHaveLength(0)
  })

  it('renders one card per service', () => {
    const services = [
      makeService({ name: 'sonarr', image: 'linuxserver/sonarr' }),
      makeService({ name: 'radarr', image: 'linuxserver/radarr' }),
    ]
    const container = renderCards(services)
    expect(container.children).toHaveLength(2)
  })

  it('renders service name as card header', () => {
    const services = [makeService({ name: 'sonarr', image: 'nginx' })]
    const container = renderCards(services)
    const header = container.querySelector('.card-header')
    expect(header).not.toBeNull()
    expect(header!.textContent).toBe('sonarr')
  })

  it('renders image field', () => {
    const services = [makeService({ name: 'app', image: 'nginx:latest' })]
    const container = renderCards(services)
    const labels = container.querySelectorAll('.card-label')
    const imageLabel = Array.from(labels).find(l => l.textContent === 'Image')
    expect(imageLabel).toBeDefined()
    const value = imageLabel!.nextElementSibling
    expect(value!.textContent).toBe('nginx:latest')
  })

  it('omits empty sections', () => {
    const services = [makeService({ name: 'app', image: 'nginx' })]
    const container = renderCards(services)
    const labels = container.querySelectorAll('.card-label')
    const labelTexts = Array.from(labels).map(l => l.textContent)
    // Should have Image but not Ports, Volumes, Networks, Environment, Extras
    expect(labelTexts).toContain('Image')
    expect(labelTexts).not.toContain('Ports')
    expect(labelTexts).not.toContain('Volumes')
    expect(labelTexts).not.toContain('Networks')
    expect(labelTexts).not.toContain('Environment')
  })

  it('renders ports when present', () => {
    const services = [makeService({ name: 'app', image: 'nginx', ports: ['80:80', '443:443'] })]
    const container = renderCards(services)
    const labels = container.querySelectorAll('.card-label')
    const portsLabel = Array.from(labels).find(l => l.textContent === 'Ports')
    expect(portsLabel).toBeDefined()
    const value = portsLabel!.nextElementSibling
    expect(value!.textContent).toContain('80:80')
    expect(value!.textContent).toContain('443:443')
  })

  it('renders environment variables correctly', () => {
    const env = new Map([['PUID', '1000'], ['TZ', 'UTC']])
    const services = [makeService({ name: 'app', image: 'nginx', environment: env })]
    const container = renderCards(services)
    const labels = container.querySelectorAll('.card-label')
    const envLabel = Array.from(labels).find(l => l.textContent === 'Environment')
    expect(envLabel).toBeDefined()
    const value = envLabel!.nextElementSibling
    expect(value!.textContent).toContain('PUID=1000')
    expect(value!.textContent).toContain('TZ=UTC')
  })

  it('renders extras when present', () => {
    const extras = new Map([['restart', 'unless-stopped']])
    const services = [makeService({ name: 'app', image: 'nginx', extras })]
    const container = renderCards(services)
    const labels = container.querySelectorAll('.card-label')
    const extrasTexts = Array.from(labels).map(l => l.textContent)
    expect(extrasTexts).toContain('restart')
  })

  it('does not use innerHTML (no XSS vector)', () => {
    const services = [makeService({ name: '<script>alert(1)</script>', image: '<img onerror=alert(1)>' })]
    const container = renderCards(services)
    const html = container.outerHTML
    // Script tags must be entity-encoded, not rendered as real elements
    expect(html).not.toContain('<script>')
    // The image tag must be entity-encoded, not a real img element
    expect(html).toContain('&lt;img')
    expect(container.querySelectorAll('script')).toHaveLength(0)
    expect(container.querySelectorAll('img')).toHaveLength(0)
  })

  it('renders volumes as structured grid with arrow separator', () => {
    const services = [makeService({
      name: 'app',
      image: 'nginx',
      volumes: ['/config:/config', '/mnt/data/media:/data:ro'],
    })]
    const container = renderCards(services)
    const grid = container.querySelector('.vol-grid')
    expect(grid).not.toBeNull()
    // Each volume produces 4 grid cells: source, arrow, target, mode
    expect(grid!.children).toHaveLength(8)

    // First volume: /config → /config (no mode)
    expect(grid!.children[0]!.textContent).toBe('/config')
    expect(grid!.children[1]!.textContent).toBe('\u2192')
    expect(grid!.children[2]!.textContent).toBe('/config')
    expect(grid!.children[3]!.textContent).toBe('')

    // Second volume: /mnt/data/media → /data ro
    expect(grid!.children[4]!.textContent).toBe('/mnt/data/media')
    expect(grid!.children[5]!.textContent).toBe('\u2192')
    expect(grid!.children[6]!.textContent).toBe('/data')
    expect(grid!.children[7]!.textContent).toBe('ro')
  })

  it('renders Volumes label alongside vol-grid', () => {
    const services = [makeService({ name: 'app', image: 'nginx', volumes: ['/a:/b'] })]
    const container = renderCards(services)
    const labels = container.querySelectorAll('.card-label')
    const volLabel = Array.from(labels).find(l => l.textContent === 'Volumes')
    expect(volLabel).toBeDefined()
    expect(volLabel!.nextElementSibling!.className).toBe('vol-grid')
  })

  it('renders network names in card', () => {
    const services = [makeService({
      name: 'app',
      image: 'nginx',
      networks: [net('frontend'), net('backend')],
    })]
    const container = renderCards(services)
    const labels = container.querySelectorAll('.card-label')
    const netLabel = Array.from(labels).find(l => l.textContent === 'Networks')
    expect(netLabel).toBeDefined()
    const netSection = netLabel!.parentElement!
    expect(netSection.textContent).toContain('frontend')
    expect(netSection.textContent).toContain('backend')
  })

  it('renders network aliases in card', () => {
    const services = [makeService({
      name: 'plex',
      image: 'plex',
      networks: [net('media', { aliases: ['plex-media', 'media-server'] })],
    })]
    const container = renderCards(services)
    const labels = container.querySelectorAll('.card-label')
    const netLabel = Array.from(labels).find(l => l.textContent === 'Networks')
    expect(netLabel).toBeDefined()
    const netSection = netLabel!.parentElement!
    expect(netSection.textContent).toContain('media')
    expect(netSection.textContent).toContain('plex-media')
    expect(netSection.textContent).toContain('media-server')
  })

  it('renders network ipv4 address in card', () => {
    const services = [makeService({
      name: 'app',
      image: 'nginx',
      networks: [net('backend', { ipv4Address: '172.20.0.10' })],
    })]
    const container = renderCards(services)
    const labels = container.querySelectorAll('.card-label')
    const netLabel = Array.from(labels).find(l => l.textContent === 'Networks')
    const netSection = netLabel!.parentElement!
    expect(netSection.textContent).toContain('172.20.0.10')
  })

  it('renders network with both aliases and ip', () => {
    const services = [makeService({
      name: 'app',
      image: 'nginx',
      networks: [net('media', { aliases: ['plex-alias'], ipv4Address: '172.20.0.5' })],
    })]
    const container = renderCards(services)
    const labels = container.querySelectorAll('.card-label')
    const netLabel = Array.from(labels).find(l => l.textContent === 'Networks')
    const netSection = netLabel!.parentElement!
    expect(netSection.textContent).toContain('media')
    expect(netSection.textContent).toContain('plex-alias')
    expect(netSection.textContent).toContain('172.20.0.5')
  })
})

describe('parseVolume', () => {
  it('parses source:target', () => {
    expect(parseVolume('/config:/config')).toEqual({ source: '/config', target: '/config', mode: '' })
  })

  it('parses source:target:mode', () => {
    expect(parseVolume('/data:/data:ro')).toEqual({ source: '/data', target: '/data', mode: 'ro' })
  })

  it('parses rw mode', () => {
    expect(parseVolume('/data:/data:rw')).toEqual({ source: '/data', target: '/data', mode: 'rw' })
  })

  it('handles volume with no colon as source-only', () => {
    expect(parseVolume('myvolume')).toEqual({ source: 'myvolume', target: '', mode: '' })
  })

  it('handles named volume:target', () => {
    expect(parseVolume('pgdata:/var/lib/postgresql')).toEqual({
      source: 'pgdata',
      target: '/var/lib/postgresql',
      mode: '',
    })
  })

  it('parses compound comma-separated modes', () => {
    expect(parseVolume('/data:/data:ro,z')).toEqual({ source: '/data', target: '/data', mode: 'ro,z' })
  })

  it('parses nocopy mode', () => {
    expect(parseVolume('/data:/data:nocopy')).toEqual({ source: '/data', target: '/data', mode: 'nocopy' })
  })

  it('handles empty string', () => {
    expect(parseVolume('')).toEqual({ source: '', target: '', mode: '' })
  })
})
