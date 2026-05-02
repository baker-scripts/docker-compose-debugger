import { load } from 'js-yaml'
import { isRecord } from './patterns'

export interface ExtractResult {
  readonly yaml: string | null
  readonly error: string | null
}

const HTML_ENTITY_PATTERN = /&(amp|lt|gt|quot|#39|apos|nbsp|#x?[0-9a-f]+);/i
const PERCENT_ENCODED_PATTERN = /%[0-9a-fA-F]{2}/

// When users paste from a rendered HTML page (forum thread, wiki, GitHub diff
// preview, autocompose web demo), the input arrives with HTML entities and/or
// percent-encoded sequences instead of literal characters. YAML will reject
// these. Decode them up front so the rest of the pipeline sees plain text.
function decodeHtmlEntities(input: string): string {
  if (typeof document === 'undefined') return input
  // The textarea innerHTML trick handles named entities (&amp;), decimal
  // (&#34;), and hex (&#x22;) without exposing us to script injection — the
  // value is read back as text, never inserted into the live DOM.
  const ta = document.createElement('textarea')
  ta.innerHTML = input
  return ta.value
}

function decodePercentEncoding(input: string): string {
  // decodeURIComponent throws on malformed sequences (e.g. lone %). Decode
  // each match individually so a single bad sequence doesn't drop the whole
  // input.
  return input.replace(/%[0-9a-fA-F]{2}/g, match => {
    try {
      return decodeURIComponent(match)
    } catch {
      return match
    }
  })
}

export function normalizeEncodedInput(raw: string): string {
  let out = raw
  if (HTML_ENTITY_PATTERN.test(out)) {
    out = decodeHtmlEntities(out)
  }
  // Only apply percent-decoding when there are at least two encoded sequences
  // so a stray "%2" or "%20" inside a literal string doesn't get mangled.
  const matches = out.match(/%[0-9a-fA-F]{2}/g)
  if (matches && matches.length >= 2 && PERCENT_ENCODED_PATTERN.test(out)) {
    out = decodePercentEncoding(out)
  }
  return out
}

const YAML_START_KEYS = /^(version|services|name|networks|volumes|x-)[\s:]/

const SHELL_PREFIX = /^[$#>]\s|^(sudo\s|docker\s|podman\s)/

const TERMINAL_PROMPT = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+[:\s~$#]/

function findYamlStart(lines: readonly string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (YAML_START_KEYS.test(line)) return i
    if (line.startsWith('---')) return i
  }
  return -1
}

function trimTrailingPrompt(lines: readonly string[]): readonly string[] {
  let end = lines.length
  while (end > 0) {
    const line = lines[end - 1] ?? ''
    const trimmed = line.trim()
    if (trimmed === '' || TERMINAL_PROMPT.test(trimmed) || SHELL_PREFIX.test(trimmed)) {
      end--
    } else {
      break
    }
  }
  return lines.slice(0, end)
}

export function extractYaml(raw: string): ExtractResult {
  const decoded = normalizeEncodedInput(raw)
  const trimmed = decoded.trim()
  if (trimmed === '') {
    return { yaml: null, error: 'No input provided. Paste your Docker Compose YAML or console output.' }
  }

  const lines = trimmed.split('\n')

  const yamlStartIdx = findYamlStart(lines)

  let yamlLines: readonly string[]
  if (yamlStartIdx >= 0) {
    yamlLines = lines.slice(yamlStartIdx)
  } else {
    // Try the whole thing — maybe it's YAML without a recognizable start key
    yamlLines = lines
  }

  yamlLines = trimTrailingPrompt(yamlLines)

  if (yamlLines.length === 0) {
    return { yaml: null, error: 'No valid YAML found. Make sure you copied the full output.' }
  }

  const yamlStr = yamlLines.join('\n')

  try {
    const parsed = load(yamlStr)
    if (!isRecord(parsed)) {
      return { yaml: null, error: 'Input does not appear to be a Docker Compose file. Expected a YAML mapping at root level.' }
    }
    return { yaml: yamlStr, error: null }
  } catch (e) {
    // If we skipped lines at the start, the failure may be due to truncation
    const msg = e instanceof Error ? e.message : String(e)
    const hint = yamlStartIdx > 0
      ? ' Make sure you copied the full output.'
      : ' Did you copy the full output?'
    return { yaml: null, error: `Invalid YAML: ${msg}.${hint}` }
  }
}
