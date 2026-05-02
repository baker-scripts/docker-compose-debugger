function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined' || document.body === null) return false

  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.width = '1px'
  textarea.style.height = '1px'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)

  let success = false
  try {
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    success = document.execCommand('copy')
  } catch {
    success = false
  } finally {
    textarea.remove()
    if (previouslyFocused) previouslyFocused.focus()
  }

  return success
}

function isSecureClipboardAvailable(): boolean {
  if (typeof navigator === 'undefined') return false
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') return false
  // navigator.clipboard.writeText only works in secure contexts. Some browsers
  // expose the API but throw at call time; we still try and fall through on error.
  return true
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (isSecureClipboardAvailable()) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to legacy path
    }
  }
  return legacyCopy(text)
}

export function openPrivateBin(): void {
  window.open('https://privatebin.net/', '_blank', 'noopener,noreferrer')
}

export function openGist(): void {
  window.open('https://gist.github.com/', '_blank', 'noopener,noreferrer')
}
