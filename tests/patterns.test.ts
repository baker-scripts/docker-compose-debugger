import { describe, it, expect } from 'vitest'
import { anonymizeHomePath, containsEmail, containsSensitiveValue, isSensitiveKey } from '../src/patterns'

describe('isSensitiveKey', () => {
  it.each([
    ['MYSQL_PASSWORD', true],
    ['DB_PASS', true],
    ['API_KEY', true],
    ['AUTH_TOKEN', true],
    ['VPN_USER', true],
    ['SECRET_KEY', true],
    ['PRIVATE_KEY', true],
    ['CREDENTIAL', true],
    ['OAUTH_SECRET', true],
    ['JWT_TOKEN', true],
    ['PW', true],
  ])('returns %s for %s', (key, expected) => {
    expect(isSensitiveKey(key)).toBe(expected)
  })

  it.each([
    ['PUID', false],
    ['PGID', false],
    ['TZ', false],
    ['UMASK', false],
    ['UMASK_SET', false],
    ['WEBUI_PORT', false],
    ['LOG_LEVEL', false],
    ['HOME', false],
    ['PATH', false],
    ['LANG', false],
    ['LC_ALL', false],
  ])('returns %s for safelisted key %s', (key, expected) => {
    expect(isSensitiveKey(key)).toBe(expected)
  })

  it('handles lowercase keys', () => {
    expect(isSensitiveKey('mysql_password')).toBe(true)
    expect(isSensitiveKey('api_key')).toBe(true)
  })

  it('respects custom sensitive patterns', () => {
    const custom = [/^MY_CUSTOM$/i]
    expect(isSensitiveKey('MY_CUSTOM', custom)).toBe(true)
    expect(isSensitiveKey('SOMETHING_ELSE', custom)).toBe(false)
  })

  it('respects custom safe keys', () => {
    const safeKeys = new Set(['AUTH_TOKEN'])
    expect(isSensitiveKey('AUTH_TOKEN', undefined, safeKeys)).toBe(false)
  })

  it.each([
    ['DATABASE_URL', true],
    ['REDIS_URL', true],
    ['MONGO_URI', true],
    ['POSTGRES_DSN', true],
    ['CELERY_BROKER_URL', true],
    ['DB_CONNECTION_STRING', true],
    ['AWS_ACCESS_KEY_ID', true],
    ['AWS_SECRET_ACCESS_KEY', true],
    ['TAILSCALE_AUTHKEY', true],
    ['TAILSCALE_AUTH_KEY', true],
    ['DISCORD_WEBHOOK', true],
    ['GH_TOKEN', true],
    ['GITHUB_PAT', true],
  ])('catches connection-string / vendor-key conventions: %s', (key, expected) => {
    expect(isSensitiveKey(key)).toBe(expected)
  })

  it('strips _FILE suffix before matching (Docker secrets)', () => {
    expect(isSensitiveKey('POSTGRES_PASSWORD_FILE')).toBe(true)
    expect(isSensitiveKey('DATABASE_URL_FILE')).toBe(true)
    expect(isSensitiveKey('PUID_FILE')).toBe(false)
  })
})

describe('containsSensitiveValue', () => {
  it('detects basic-auth in URLs', () => {
    expect(containsSensitiveValue('postgres://user:hunter2@db.example.com:5432/app')).toBe(true)  // pragma: allowlist secret
    expect(containsSensitiveValue('mongodb://admin:s3cret@mongo:27017/?authSource=admin')).toBe(true)  // pragma: allowlist secret
    expect(containsSensitiveValue('https://service:p@ss@example.com')).toBe(true)  // pragma: allowlist secret
  })

  it('detects GitHub PATs', () => {
    expect(containsSensitiveValue('ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789')).toBe(true)  // pragma: allowlist secret
    expect(containsSensitiveValue('gho_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789')).toBe(true)  // pragma: allowlist secret
    expect(containsSensitiveValue('GHP_AbCdEf')).toBe(false)  // too short
  })

  it('detects AWS access key IDs', () => {
    expect(containsSensitiveValue('AKIAIOSFODNN7EXAMPLE')).toBe(true)  // pragma: allowlist secret
    expect(containsSensitiveValue('ASIATESTKEYABCDEFGHI')).toBe(true)  // pragma: allowlist secret
  })

  it('detects Tailscale auth keys', () => {
    expect(containsSensitiveValue('tskey-auth-kAbCd1EfG2-XyZAbcDef123456789')).toBe(true)  // pragma: allowlist secret
  })

  it('detects Discord webhooks', () => {
    // pragma: allowlist nextline secret
    expect(containsSensitiveValue('https://discord.com/api/webhooks/123456789012345678/AbCdEfGhIjKl_MnOpQrSt-uVwXyZ')).toBe(true)
  })

  it('detects Slack webhooks', () => {
    // pragma: allowlist nextline secret
    expect(containsSensitiveValue('https://hooks.slack.com/services/T01ABCDEFGH/B01ABCDEFGH/abcdEFGHijklMNOP1234')).toBe(true)
  })

  it('detects JWT-like tokens', () => {
    // pragma: allowlist nextline secret
    expect(containsSensitiveValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')).toBe(true)
  })

  it('does not flag normal values', () => {
    expect(containsSensitiveValue('linuxserver/sonarr:latest')).toBe(false)
    expect(containsSensitiveValue('America/Chicago')).toBe(false)
    expect(containsSensitiveValue('1000:1000')).toBe(false)
    expect(containsSensitiveValue('https://media.example.com/')).toBe(false)
  })
})

describe('containsEmail', () => {
  it('detects standard emails', () => {
    expect(containsEmail('user@example.com')).toBe(true)
    expect(containsEmail('admin@mail.server.org')).toBe(true)
  })

  it('detects emails within longer strings', () => {
    expect(containsEmail('Send to user@example.com please')).toBe(true)
  })

  it('rejects non-emails', () => {
    expect(containsEmail('no-email-here')).toBe(false)
    expect(containsEmail('just-a-string')).toBe(false)
    expect(containsEmail('@')).toBe(false)
  })
})

describe('anonymizeHomePath', () => {
  it('replaces /home/<user>/ with ~/', () => {
    expect(anonymizeHomePath('/home/john/media:/tv')).toBe('~/media:/tv')
  })

  it('leaves ~/ paths unchanged', () => {
    expect(anonymizeHomePath('~/config:/config')).toBe('~/config:/config')
  })

  it('leaves non-home paths unchanged', () => {
    expect(anonymizeHomePath('/mnt/data/media:/tv')).toBe('/mnt/data/media:/tv')
  })

  it('replaces /root/ with ~/', () => {
    expect(anonymizeHomePath('/root/.config:/config')).toBe('~/.config:/config')
  })

  it('handles paths without container mount', () => {
    expect(anonymizeHomePath('/home/user/data')).toBe('~/data')
  })
})
