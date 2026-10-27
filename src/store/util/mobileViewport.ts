/** Keep the reference and editor inside the space above the software keyboard.
 * Never reposition body or blur the editor when the reader scrolls the reference.
 */
export function bindMobileViewport (input: HTMLTextAreaElement): () => void {
  const root = document.documentElement
  const viewport = window.visualViewport
  let frame = 0
  let blurTimer = 0
  let active = false

  const sync = () => {
    frame = 0
    if (!active) return
    const height = viewport ? viewport.height : window.innerHeight
    root.style.setProperty('--practice-viewport-height', `${height}px`)
    root.style.setProperty('--practice-viewport-top', `${viewport ? viewport.offsetTop : 0}px`)
    root.toggleAttribute('data-mobile-practice-compact', height < 280)
  }
  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(sync)
  }
  const deactivate = () => {
    active = false
    root.removeAttribute('data-mobile-practice')
    root.removeAttribute('data-mobile-practice-compact')
    root.style.removeProperty('--practice-viewport-height')
    root.style.removeProperty('--practice-viewport-top')
  }
  const focus = () => {
    window.clearTimeout(blurTimer)
    active = true
    sync()
    root.setAttribute('data-mobile-practice', '')
  }
  const blur = () => {
    // Automatic retries can refocus the same editor in the next Vue update.
    blurTimer = window.setTimeout(() => {
      if (document.activeElement !== input) deactivate()
    }, 100)
  }

  input.addEventListener('focus', focus)
  input.addEventListener('blur', blur)
  window.addEventListener('resize', schedule)
  if (viewport) {
    viewport.addEventListener('resize', schedule)
    viewport.addEventListener('scroll', schedule)
  }
  if (document.activeElement === input) focus()

  return () => {
    window.cancelAnimationFrame(frame)
    window.clearTimeout(blurTimer)
    input.removeEventListener('focus', focus)
    input.removeEventListener('blur', blur)
    window.removeEventListener('resize', schedule)
    if (viewport) {
      viewport.removeEventListener('resize', schedule)
      viewport.removeEventListener('scroll', schedule)
    }
    deactivate()
  }
}
