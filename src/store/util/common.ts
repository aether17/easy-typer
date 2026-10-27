export function shuffle (arr: string[]) {
  let m = arr.length
  while (m > 1) {
    const index = Math.floor(Math.random() * m--)
    ;[arr[m], arr[index]] = [arr[index], arr[m]]
  }
  return arr
}

export function shuffleText (text: string) {
  const arr = text.split('')
  return shuffle(arr).join('')
}

export function initColorMode (mode = '', initial = false) {
  const html = document.getElementsByTagName('html')[0]
  const colorMode = !initial ? mode : (localStorage.getItem('colorMode') as string || '')
  html.setAttribute('class', colorMode)
}

export const isNative = !!window.electronAPI

export function initEnv () {
  const html = document.getElementsByTagName('html')[0]
  isNative && html.setAttribute('data-is-native', '')
  window.__typer = {
    env: isNative ? 'native' : 'web'
  }
}

export function loadFonts () {
  if ('fonts' in document) {
    if (sessionStorage.fontsLoadedFoft) {
      document.body.className += ' fonts-loaded'
      return
    }

    Promise.all([
      document.fonts.load('400 1em LXGWWenKai')
      // document.fonts.load('100 1em LXGWWenKai'),
      // document.fonts.load('700 1em LXGWWenKai')
    ]).then(function () {
      document.body.className += ' fonts-loaded'
      sessionStorage.fontsLoadedFoft = true
    })
  }
}

const SPEED_GAP = 30
const rankLevel = {
  lv1: '菜鸟',
  lv2: '新手',
  lv3: '熟手',
  lv4: '高手',
  lv5: '大师',
  lv6: '大神',
  lv7: '王者',
  lv8: '传奇'
}
export function speedRank (speed: number) {
  // 小于30菜鸟 30-60新手 60-90熟手 90-120高手 120-150大师 150-180大神 180-210王者 大于210传奇
  const rawLevel = Math.ceil(speed / SPEED_GAP)
  const level = rawLevel > 8 ? 8 : rawLevel
  const rank = `lv${level}` as keyof typeof rankLevel

  return rankLevel[rank]
}

export function accuracyRank (accuracy: number) {
  if (accuracy >= 100) return '百准神仙'
  if (accuracy >= 99) return '键准大神'
  if (accuracy >= 97) return '键准大师'
  if (accuracy >= 95) return '键准高手'
  if (accuracy >= 92) return '键准熟手'
  return '键准新手'
}

export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export const replaceTextSpace = (content = '') => content.replace(/[\n\r\s]/g, '')

export const formatDuration = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor(((seconds % 86400) % 3600) / 60)
  const secs = Math.floor(((seconds % 86400) % 3600) % 60)

  if (days > 0) {
    return `${days}天${hours}时${minutes}分${secs}秒`
  } else if (hours > 0) {
    return `${hours}时${minutes}分${secs}秒`
  } else if (minutes > 0) {
    return `${minutes}分${secs}秒`
  } else {
    return `${secs}秒`
  }
}

export const splitLongText = (text: string) => {
  const MAX_LENGTH = 1050
  const PUNCTUATION_MARKS = ['。', '！', '？', '；']
  const result = []
  if (text.length <= MAX_LENGTH) {
    result.push(text)
    return result
  }
  let start = 0
  while (start < text.length) {
    const end = start + MAX_LENGTH
    if (end >= text.length) {
      result.push(text.substring(start))
      break
    }
    const subtext = text.substring(start, end)
    let lastPunctuationIndex = -1
    for (const mark of PUNCTUATION_MARKS) {
      const index = subtext.lastIndexOf(mark)
      if (index !== -1 && index > lastPunctuationIndex) {
        lastPunctuationIndex = index
      }
    }
    if (lastPunctuationIndex === -1) {
      lastPunctuationIndex = MAX_LENGTH
    }
    result.push(text.substring(start, start + lastPunctuationIndex + 1))
    start += lastPunctuationIndex + 1
  }
  return result
}

export const generateRandomLetters = (length: number, withUppercase = false): string => {
  let result = ''
  const characters = withUppercase ? 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'abcdefghijklmnopqrstuvwxyz'
  const charactersLength = characters.length
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

export const generateRandomNumbers = (length: number): string => {
  const numbers = Array.from({ length: 10 }, (_, i) => i) // 生成数字范围0-9的数组
  const result = []

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * numbers.length) // 随机选择一个数字
    result.push(numbers[randomIndex]) // 将该数字加入结果数组
  }

  return result.join('')
}

export const generateLettersAndNumbers = (length: number): string => {
  const half = Math.floor(length / 2)
  return shuffleText(generateRandomLetters(half, true) + generateRandomNumbers(half))
}

export const criteriaActionText = {
  random: '乱序',
  retry: '重打',
  noop: '不处理'
}
