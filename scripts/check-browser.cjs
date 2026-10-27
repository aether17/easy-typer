const { chromium } = require('playwright')
const http = require('http')
const fs = require('fs')
const path = require('path')
const assert = require('assert/strict')

const root = path.resolve(__dirname, '../docs')
const results = path.resolve(__dirname, '../test-results')
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.woff': 'font/woff', '.ttf': 'font/ttf' }
const server = http.createServer((req, res) => {
  let filename = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname))
  if (!filename.startsWith(root + path.sep) && filename !== root) { res.writeHead(403).end(); return }
  if (!fs.existsSync(filename) || fs.statSync(filename).isDirectory()) filename = path.join(root, 'index.html')
  res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream')
  res.end(fs.readFileSync(filename))
})

async function main () {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ headless: true })
  fs.mkdirSync(results, { recursive: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      serviceWorkers: 'block' })
    const errors = []
    const external = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => {
      if (route.request().url().startsWith(origin)) return route.continue()
      external.push(route.request().url())
      return route.abort()
    })
    await page.addInitScript(() => {
      const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 })
      window.testViewport = viewport
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
      window.clipboardWrites = []
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async text => { window.clipboardWrites.push(text) }
      } })
    })
    await page.goto(origin)
    await page.waitForFunction(() => document.getElementById('app').__vue__?.$store)
    assert.equal(await page.evaluate(() => document.getElementById('app').__vue__.$store.state.setting.offClipboard), true)
    // Upgrade an actual saved configuration, preserving unrelated settings and
    // later explicit opt-in choices across reloads.
    await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('QuickTyping')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const saved = { ...document.getElementById('app').__vue__.$store.state.setting }
        delete saved.clipboardPreferenceVersion
        saved.offClipboard = false
        saved.fontWeight = 500
        const tx = db.transaction('configs', 'readwrite')
        tx.objectStore('configs').put(saved, 'setting')
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
    }))
    async function reloadSettings () {
      await page.reload()
      await page.waitForFunction(() => document.getElementById('app').__vue__?.$store.state.setting.loaded)
      return page.evaluate(() => {
        const s = document.getElementById('app').__vue__.$store.state.setting
        return { offClipboard: s.offClipboard, version: s.clipboardPreferenceVersion, fontWeight: s.fontWeight }
      })
    }
    const migrated = { offClipboard: true, version: 1, fontWeight: 500 }
    assert.deepEqual(await reloadSettings(), migrated)
    assert.deepEqual(await reloadSettings(), migrated, 'Migrated clipboard preference must persist')
    await page.evaluate(() => { document.getElementById('app').__vue__.$store.commit('setting/toggleClipboard', false) })
    assert.deepEqual(await reloadSettings(), { ...migrated, offClipboard: false }, 'Explicit opt-in must survive reload')
    await page.evaluate(() => { document.getElementById('app').__vue__.$store.commit('setting/toggleClipboard', true) })
    assert.deepEqual(await reloadSettings(), migrated)
    const catalog = await (await page.request.get(origin + '/practice-texts/list.json')).json()
    for (const group of catalog) {
      for (const item of group.children) {
        if (item.id < 0) continue
        const data = await (await page.request.get(`${origin}/practice-texts/${item.id}.json`)).json()
        assert.ok(data.content && data.title)
      }
    }
    const front = await (await page.request.get(origin + '/practice-texts/44.json')).json()
    assert.equal([...front.content].length, 500)

    async function load (text, size = text.length, criteria = {}) {
      await page.evaluate(async ({ text, size, criteria }) => {
        const store = document.getElementById('app').__vue__.$store
        await store.dispatch('kata/init')
        await store.dispatch('kata/updateCriteria', { criteriaOpen: false, criteriaHitSpeed: 0,
          criteriaAccuracy: 100, criteriaSpeed: 0, criteriaAchieved: 1, criteriaAction: 'retry', ...criteria })
        await store.dispatch('kata/loadArticle', { articleTitle: '浏览器回归测试', articleText: text,
          paragraphSize: size, currentParagraphNo: 1, textType: 1 })
        await store.dispatch('article/loadMatch', store.getters['kata/nextParagraph'])
      }, { text, size, criteria })
      await page.waitForTimeout(130)
      await page.locator('#racing-textarea').focus()
    }
    await load(front.content)
    // Simulate both keyboard resizing and panning while layout viewport stays large.
    async function checkMobileBounds (hasHistory = false) {
      for (const [width, height, top] of [[390, 340, 96], [360, 260, 0], [844, 180, 24]]) {
        await page.setViewportSize({ width, height: 844 })
        await page.evaluate(({ height, top }) => {
          Object.assign(window.testViewport, { height, offsetTop: top })
          window.testViewport.dispatchEvent(new Event('resize'))
          window.testViewport.dispatchEvent(new Event('scroll'))
        }, { height, top })
        await page.waitForTimeout(80)
        const bounds = await page.evaluate(() => {
          const reference = document.querySelector('#article-main .article').getBoundingClientRect()
          const input = document.getElementById('racing-textarea').getBoundingClientRect()
          const recent = document.querySelector('.mobile-achievements')?.getBoundingClientRect()
          const row = document.querySelector('.mobile-achievements tbody tr')?.getBoundingClientRect()
          const fontSize = parseFloat(getComputedStyle(document.querySelector('#article-main .code')).fontSize)
          return { referenceTop: reference.top, referenceBottom: reference.bottom, referenceHeight: reference.height,
            inputTop: input.top, inputBottom: input.bottom, bodyPosition: document.body.style.position, fontSize,
            recentTop: recent?.top, recentBottom: recent?.bottom, rowBottom: row?.bottom }
        })
        assert.ok(bounds.referenceTop >= top - 1, JSON.stringify(bounds))
        assert.ok(bounds.fontSize >= 28, JSON.stringify(bounds))
        assert.ok(bounds.referenceHeight >= bounds.fontSize * 1.2, JSON.stringify(bounds))
        assert.ok(bounds.referenceBottom <= bounds.inputTop, JSON.stringify(bounds))
        assert.ok(bounds.inputBottom <= top + height + 1, JSON.stringify(bounds))
        assert.equal(bounds.bodyPosition, '')
        if (hasHistory) {
          assert.ok(bounds.recentTop >= bounds.inputBottom, JSON.stringify(bounds))
          assert.ok(bounds.recentBottom <= top + height + 1, JSON.stringify(bounds))
          assert.ok(bounds.rowBottom <= bounds.recentBottom + 1, JSON.stringify(bounds))
          assert.equal(await page.locator('.desktop-achievements').first().isVisible(), false)
          await page.screenshot({ path: path.join(results, `mobile-history-${width}.png`) })
        }
      }
    }
    await checkMobileBounds()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.evaluate(() => {
      Object.assign(window.testViewport, { height: 340, offsetTop: 0 })
      window.testViewport.dispatchEvent(new Event('resize'))
    })
    await page.locator('#racing-textarea').press('a')
    await page.locator('#racing-textarea').fill(front.content.slice(0, 330))
    await page.waitForTimeout(100)
    const currentVisible = await page.evaluate(() => {
      const board = document.querySelector('#article-main .article')
      const text = board.querySelector('.pending > span').firstChild
      const range = document.createRange()
      range.setStart(text, 0); range.setEnd(text, 1)
      const rect = range.getBoundingClientRect(); const frame = board.getBoundingClientRect()
      return rect.top >= frame.top - 1 && rect.bottom <= frame.bottom + 1 && board.scrollTop > 0
    })
    assert.ok(currentVisible, 'The next character must stay visible after long-text scrolling')
    await page.evaluate(() => window.dispatchEvent(new Event('touchmove')))
    assert.ok(await page.locator('#racing-textarea').evaluate(el => document.activeElement === el))
    await page.screenshot({ path: path.join(results, 'mobile-keyboard-layout.png') })

    await load('abcdwxyz', 4, { criteriaOpen: true, criteriaSpeed: 500 })
    await page.locator('#racing-textarea').pressSequentially('abcd', { delay: 500 })
    await page.waitForTimeout(150)
    let state = await page.evaluate(() => { const s = document.getElementById('app').__vue__.$store.state; return { group: s.kata.currentParagraphNo, retry: s.racing.retry } })
    assert.equal(state.group, 1)
    assert.ok(state.retry > 1, 'Below-speed attempt should automatically repeat')

    await load('abcdwxyz', 4, { criteriaOpen: true, criteriaSpeed: 0, criteriaAccuracy: 100 })
    await page.locator('#racing-textarea').pressSequentially('abx', { delay: 80 })
    await page.locator('#racing-textarea').press('Backspace')
    await page.locator('#racing-textarea').pressSequentially('cd', { delay: 80 })
    await page.waitForTimeout(150)
    state = await page.evaluate(() => { const s = document.getElementById('app').__vue__.$store.state; return { group: s.kata.currentParagraphNo, retry: s.racing.retry } })
    assert.equal(state.group, 1)
    assert.ok(state.retry > 1, 'Correcting an error must not bypass the accuracy requirement')
    await page.locator('#racing-textarea').pressSequentially('abcd', { delay: 80 })
    await page.waitForTimeout(150)
    assert.equal(await page.evaluate(() => document.getElementById('app').__vue__.$store.state.kata.currentParagraphNo), 2)

    assert.deepEqual(await page.evaluate(() => window.clipboardWrites), [], 'Completed attempts must not copy results by default')
    const recentRows = await page.locator('.mobile-achievements tbody tr').allTextContents()
    assert.equal(recentRows.length, 3)
    const expectedRows = await page.evaluate(() => document.getElementById('app').__vue__.$store.state.achievements.slice(0, 3)
      .map(row => `${row.identity}${row.typeSpeed}${row.hitSpeed}${row.codeLength}${row.accuracy}%`))
    assert.deepEqual(recentRows.map(row => row.trim()), expectedRows)
    assert.deepEqual(await page.locator('.mobile-achievements th').allTextContents(), ['编号', '速度（字/分）', '击键', '码长', '准确率'])
    await load(front.content)
    await checkMobileBounds(true)
    // Scrolling older attempts must keep the keyboard/editor focused.
    await page.locator('.mobile-achievements').evaluate(el => { el.scrollTop = el.scrollHeight })
    assert.ok(await page.locator('#racing-textarea').evaluate(el => document.activeElement === el))

    await page.evaluate(() => { document.getElementById('app').__vue__.$router.push('/kata') })
    await page.waitForURL('**/kata')
    await page.getByPlaceholder('请选择练习文本').waitFor()
    assert.equal(await page.locator('html').getAttribute('data-mobile-practice'), null)
    assert.equal(await page.locator('html').getAttribute('data-mobile-practice-compact'), null)
    assert.ok(await page.getByPlaceholder('请选择练习文本').isVisible())
    assert.deepEqual(errors, [])
    assert.deepEqual(external, [], 'Core practice must not request any external services')
    await page.close()

    const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
    await desktop.goto(origin)
    await desktop.locator('#racing-textarea').focus()
    assert.equal(await desktop.locator('html').getAttribute('data-mobile-practice'), null)
    assert.ok(await desktop.locator('.desktop-achievements').first().isVisible())
    await desktop.screenshot({ path: path.join(results, 'desktop.png') })
    console.log('PASS: local texts; keyboard bounds with/without recent results; larger reference text; clipboard default/migration/persistence; no completion clipboard writes; speed/accuracy gates; recent results; route cleanup; desktop layout; no external requests.')
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => server.close())
