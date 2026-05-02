import { describe, it, expect } from 'vitest'
import {
  buildCombinedMarkdown,
  formatForDiscord,
  formatForGitHub,
  generateMarkdownTable,
  generateVolumeComparisonMarkdown,
} from '../src/markdown'
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

describe('generateMarkdownTable', () => {
  it('returns empty string for no services', () => {
    expect(generateMarkdownTable([])).toBe('')
  })

  it('produces valid markdown table for a single service', () => {
    const services = [
      makeService({
        name: 'sonarr',
        image: 'linuxserver/sonarr:latest',
        ports: ['8989:8989'],
        volumes: ['/config:/config', '/data:/data'],
        networks: [net('default')],
      }),
    ]
    const result = generateMarkdownTable(services)
    const lines = result.split('\n')
    // Header row (no Volumes column — volumes are in separate comparison table)
    expect(lines[0]).toBe('| Service | Image | Ports | Networks |')
    // Separator
    expect(lines[1]).toBe('| --- | --- | --- | --- |')
    // Data row
    expect(lines[2]).toContain('sonarr')
    expect(lines[2]).toContain('linuxserver/sonarr:latest')
    expect(lines[2]).toContain('8989:8989')
    expect(lines[2]).toContain('default')
  })

  it('produces correct rows for multiple services', () => {
    const services = [
      makeService({ name: 'alpha', image: 'alpha:1', ports: ['80:80'] }),
      makeService({ name: 'beta', image: 'beta:2', volumes: ['/data:/data'] }),
    ]
    const result = generateMarkdownTable(services)
    const lines = result.split('\n')
    expect(lines).toHaveLength(4) // header + separator + 2 data rows
    expect(lines[2]).toContain('alpha')
    expect(lines[3]).toContain('beta')
  })

  it('produces empty cells for missing fields, not undefined', () => {
    const services = [
      makeService({ name: 'minimal', image: 'nginx' }),
    ]
    const result = generateMarkdownTable(services)
    expect(result).not.toContain('undefined')
    const lines = result.split('\n')
    // Data row should have empty cells for ports, networks
    expect(lines[2]).toBe('| minimal | nginx |  |  |')
  })

  it('includes extras columns dynamically', () => {
    const services = [
      makeService({ name: 'app', image: 'nginx', extras: new Map([['restart', 'unless-stopped'], ['hostname', 'app-host']]) }),
      makeService({ name: 'db', image: 'postgres', extras: new Map([['restart', 'always']]) }),
    ]
    const result = generateMarkdownTable(services)
    const lines = result.split('\n')
    // Header includes extras
    expect(lines[0]).toContain('restart')
    expect(lines[0]).toContain('hostname')
    // app row has both
    expect(lines[2]).toContain('unless-stopped')
    expect(lines[2]).toContain('app-host')
    // db row has restart but empty hostname
    expect(lines[3]).toContain('always')
  })

  it('escapes pipe characters in field values', () => {
    const services = [
      makeService({ name: 'app', image: 'my|image' }),
    ]
    const result = generateMarkdownTable(services)
    expect(result).toContain('my\\|image')
    expect(result).not.toContain('my|image')
  })

  it('joins multi-value fields with comma separator', () => {
    const services = [
      makeService({
        name: 'app',
        image: 'nginx',
        ports: ['80:80', '443:443'],
        networks: [net('frontend'), net('backend')],
      }),
    ]
    const result = generateMarkdownTable(services)
    const lines = result.split('\n')
    expect(lines[2]).toContain('80:80, 443:443')
    expect(lines[2]).toContain('frontend, backend')
  })

  it('escapes newlines in values', () => {
    const services = [
      makeService({ name: 'app', image: 'nginx\nlatest' }),
    ]
    const result = generateMarkdownTable(services)
    expect(result).not.toContain('\n\n') // no double newlines in data
    expect(result).toContain('nginx latest') // newline replaced with space
  })

  it('renders only network name, not aliases or ip', () => {
    const services = [
      makeService({
        name: 'app',
        image: 'nginx',
        networks: [net('media', { aliases: ['plex-alias'], ipv4Address: '172.20.0.5' })],
      }),
    ]
    const result = generateMarkdownTable(services)
    expect(result).toContain('media')
    expect(result).not.toContain('plex-alias')
    expect(result).not.toContain('172.20.0.5')
  })
})

describe('generateVolumeComparisonMarkdown', () => {
  it('returns empty string for no services', () => {
    expect(generateVolumeComparisonMarkdown([])).toBe('')
  })

  it('returns empty string for services with no volumes', () => {
    const services = [makeService({ name: 'app', image: 'nginx' })]
    expect(generateVolumeComparisonMarkdown(services)).toBe('')
  })

  it('produces a markdown table with host paths as rows', () => {
    const services = [
      makeService({ name: 'plex', image: 'plex', volumes: ['/config:/config', '/mnt/data:/data'] }),
      makeService({ name: 'radarr', image: 'radarr', volumes: ['/config:/config'] }),
    ]
    const result = generateVolumeComparisonMarkdown(services)
    const lines = result.split('\n')
    // Header
    expect(lines[0]).toBe('| Host Path | plex | radarr |')
    // Separator
    expect(lines[1]).toBe('| --- | --- | --- |')
    // Data rows sorted alphabetically
    expect(lines[2]).toContain('/config')
    expect(lines[2]).toContain('/config')
    expect(lines[3]).toContain('/mnt/data')
  })

  it('shows em dash for missing mounts', () => {
    const services = [
      makeService({ name: 'a', image: 'img', volumes: ['/x:/x'] }),
      makeService({ name: 'b', image: 'img', volumes: ['/y:/y'] }),
    ]
    const result = generateVolumeComparisonMarkdown(services)
    expect(result).toContain('\u2014')
  })

  it('includes mode annotation in cells', () => {
    const services = [
      makeService({ name: 'app', image: 'img', volumes: ['/data:/data:ro'] }),
    ]
    const result = generateVolumeComparisonMarkdown(services)
    expect(result).toContain('/data (ro)')
  })

  it('escapes pipe characters in paths', () => {
    const services = [
      makeService({ name: 'app', image: 'img', volumes: ['/a|b:/c'] }),
    ]
    const result = generateVolumeComparisonMarkdown(services)
    expect(result).toContain('/a\\|b')
  })
})

describe('formatForGitHub', () => {
  it('returns empty string when no services', () => {
    expect(formatForGitHub(buildCombinedMarkdown([]))).toBe('')
  })

  it('renders headings as ### and bare markdown tables', () => {
    const services = [
      makeService({ name: 'app', image: 'nginx', volumes: ['/data:/data'] }),
    ]
    const result = formatForGitHub(buildCombinedMarkdown(services))
    expect(result).toMatch(/^### Services\n\n\| Service \|/)
    expect(result).toContain('### Volume Comparison')
    expect(result).not.toContain('```')
  })

  it('omits a section when its source table is empty', () => {
    const services = [makeService({ name: 'app', image: 'nginx' })] // no volumes
    const result = formatForGitHub(buildCombinedMarkdown(services))
    expect(result).toContain('### Services')
    expect(result).not.toContain('### Volume Comparison')
  })

  it('includes User / Group section when userGroup data is present', () => {
    const services = [
      makeService({
        name: 'app',
        image: 'nginx',
        userGroup: { user: '1000:1000', puid: '1000', pgid: '1000', groupAdd: ['video'], umask: '022' },
      }),
    ]
    const result = formatForGitHub(buildCombinedMarkdown(services))
    expect(result).toContain('### User / Group')
    expect(result).toContain('| User / Group | app |')
    expect(result).toContain('| user: | 1000:1000 |')
    expect(result).toContain('| PUID | 1000 |')
    expect(result).toContain('| group_add | video |')
    expect(result).toContain('| UMASK | 022 |')
  })
})

describe('formatForDiscord', () => {
  it('returns empty string when no services', () => {
    expect(formatForDiscord(buildCombinedMarkdown([]))).toBe('')
  })

  it('wraps each table in a fenced code block', () => {
    const services = [
      makeService({ name: 'app', image: 'nginx', volumes: ['/data:/data'] }),
    ]
    const result = formatForDiscord(buildCombinedMarkdown(services))
    // fenced blocks open and close on their own lines
    expect(result).toContain('**Services**\n```\n')
    expect(result).toContain('\n```')
    expect(result).toContain('**Volume Comparison**\n```\n')
    // exactly two opening fences (services + volume) and two closing fences
    const fences = (result.match(/```/g) ?? []).length
    expect(fences).toBe(4)
  })

  it('uses bold labels not ### so old Discord clients render', () => {
    const services = [makeService({ name: 'app', image: 'nginx' })]
    const result = formatForDiscord(buildCombinedMarkdown(services))
    expect(result).not.toContain('### ')
    expect(result).toContain('**Services**')
  })

  it('preserves the raw pipe-table content inside the fences', () => {
    const services = [makeService({ name: 'app', image: 'nginx' })]
    const result = formatForDiscord(buildCombinedMarkdown(services))
    expect(result).toContain('| Service | Image |')
    expect(result).toContain('| app | nginx |')
  })

  it('omits a section when its source table is empty', () => {
    const services = [makeService({ name: 'app', image: 'nginx' })] // no volumes
    const result = formatForDiscord(buildCombinedMarkdown(services))
    expect(result).toContain('**Services**')
    expect(result).not.toContain('**Volume Comparison**')
  })

  it('includes User / Group section wrapped in fenced code', () => {
    const services = [
      makeService({
        name: 'app',
        image: 'nginx',
        userGroup: { user: '1000:1000', puid: '', pgid: '', groupAdd: [], umask: '' },
      }),
    ]
    const result = formatForDiscord(buildCombinedMarkdown(services))
    expect(result).toContain('**User / Group**\n```\n')
    expect(result).toContain('| user: | 1000:1000 |')
    // Three sections expected: Services + User/Group (volumes omitted, no volumes data)
    const fences = (result.match(/```/g) ?? []).length
    expect(fences).toBe(4)
  })
})
