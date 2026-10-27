import { bindMobileViewport } from '@/store/util/mobileViewport'

describe('mobile keyboard viewport', () => {
  let input: HTMLTextAreaElement
  let viewport: EventTarget & { height: number; offsetTop: number }
  let cleanup: () => void
  const originalViewport = window.visualViewport

  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => window.setTimeout(() => callback(0), 16))
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => window.clearTimeout(id))
    document.body.innerHTML = '<textarea></textarea>'
    input = document.querySelector('textarea') as HTMLTextAreaElement
    viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    cleanup = bindMobileViewport(input)
  })

  afterEach(() => {
    cleanup()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: originalViewport })
    jest.restoreAllMocks()
    jest.useRealTimers()
    document.body.innerHTML = ''
  })

  it('follows a keyboard shrinking/panning the visual viewport without moving body', () => {
    input.focus()
    viewport.height = 340
    viewport.offsetTop = 96
    viewport.dispatchEvent(new Event('resize'))
    viewport.dispatchEvent(new Event('scroll'))
    jest.advanceTimersByTime(50)
    expect(document.documentElement.style.getPropertyValue('--practice-viewport-height')).toBe('340px')
    expect(document.documentElement.style.getPropertyValue('--practice-viewport-top')).toBe('96px')
    expect(document.body.style.position).toBe('')
    expect(document.body.style.top).toBe('')
    window.dispatchEvent(new Event('touchmove'))
    expect(document.activeElement).toBe(input)
  })

  it('restores the ordinary page when the editor loses focus', () => {
    input.focus()
    input.blur()
    jest.advanceTimersByTime(120)
    expect(document.documentElement.hasAttribute('data-mobile-practice')).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--practice-viewport-height')).toBe('')
  })

  it('keeps the practice layout through an automatic retry/refocus', () => {
    input.focus()
    input.blur()
    jest.advanceTimersByTime(50)
    input.focus()
    jest.advanceTimersByTime(120)
    expect(document.documentElement.hasAttribute('data-mobile-practice')).toBe(true)
  })

  it('removes all viewport listeners when the practice page is destroyed', () => {
    input.focus()
    cleanup()
    viewport.height = 300
    viewport.dispatchEvent(new Event('resize'))
    input.blur()
    input.focus()
    jest.advanceTimersByTime(200)
    expect(document.documentElement.hasAttribute('data-mobile-practice')).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--practice-viewport-height')).toBe('')
  })
})
