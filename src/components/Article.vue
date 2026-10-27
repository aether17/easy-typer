<template>
  <div id="article-main">
    <el-row ref="board" :class="articleStyle">
      <Words
        v-for="word in words"
        :key="word.id"
        :word="word"
        :break-opportunity="isInlineMode"
      />
    </el-row>
    <el-divider class="article-info" content-position="right">
      <span>第{{ identity }}段</span>
      <span>{{ title || '未知' }}</span>
      <span>共{{ length }}字</span>
    </el-divider>
  </div>
</template>

<script lang="ts">
import { Word } from '@/store/types'
import { Edge, ShortestPath } from '@/store/util/Graph'
import { Component, Vue, Watch } from 'vue-property-decorator'
import { namespace } from 'vuex-class'
import Words from '@/components/Words.vue'

const article = namespace('article')
const racing = namespace('racing')
const setting = namespace('setting')

@Component({
  components: { Words }
})
export default class Article extends Vue {
  @article.State('content')
  private content!: string

  @article.State('identity')
  private identity!: string

  @article.State('title')
  private title!: string

  @article.Getter('length')
  private length!: number

  @racing.State('input')
  private input!: string

  @article.State('shortest')
  private shortest!: ShortestPath<Word> | null;

  @racing.Getter('progress')
  private progress!: number

  @setting.State('hint')
  private hint!: boolean

  @setting.State('fontSize')
  private fontSize!: string

  @setting.State('articleRows')
  private articleRows!: number

  @setting.State('hintOptions')
  private hintOptions!: Array<string>

  private boardObserver: ResizeObserver | null = null

  mounted () {
    if (typeof ResizeObserver !== 'undefined') {
      this.boardObserver = new ResizeObserver(() => this.autoScroll(this.progress))
      this.boardObserver.observe((this.$refs.board as Vue).$el)
    }
  }

  beforeDestroy () {
    if (this.boardObserver) this.boardObserver.disconnect()
  }

  get articleStyle (): Array<string> {
    let mode = 'inline'
    if (this.hint && this.shortest && (this.codeHint || this.selectHint || this.autoSelectHint)) {
      mode = 'grid'
    }
    return ['article', mode]
  }

  get isInlineMode (): boolean {
    return this.articleStyle.indexOf('inline') >= 0
  }

  get selectHint (): boolean {
    return this.hintOptions.indexOf('select') >= 0
  }

  get codeHint (): boolean {
    return this.hintOptions.indexOf('code') >= 0
  }

  get autoSelectHint (): boolean {
    return this.hintOptions.indexOf('autoSelect') >= 0
  }

  get words (): Array<Word> {
    const length = this.content.length
    if (length === 0) {
      return []
    }

    const input = this.input
    const words: Array<Word> = []
    if (!this.hint || !this.shortest) {
      const inputLength = input.length
      const typed = this.content.substring(0, inputLength)
      this.check(0, input, typed, words)
      const pending = this.content.substring(inputLength)
      words.push(new Word(inputLength, pending, 'pending'))
    } else {
      const { path, vertices } = this.shortest
      for (let i = 0; i < length;) {
        // TODO: 扩折号会报错，如：老去——致爸
        const vertice = vertices[path[i]]
        const edge = vertice?.get(i)
        if (!edge) {
          i++
          continue
        }
        const next = this.addPhrase(input, edge, words)
        i = next === 0 ? path[i] : next
      }
    }

    return words
  }

  /**
   * 自动调整滚动条位置
   */
  @Watch('progress')
  autoScroll (progress: number) {
    // Wait for the current character's DOM to update. Use the actual panel
    // height: configured articleRows no longer describes it above a keyboard.
    this.$nextTick(() => {
      const board = this.$refs.board as Vue | undefined
      if (!board) return
      const el = board.$el as HTMLElement
      if (progress === 0) {
        el.scrollTop = 0
        return
      }
      const pending = el.querySelector('.pending > span,.code1 > span,.code2 > span,.code3 > span,.code4 > span')
      const text = pending?.firstChild
      if (!text || !text.textContent) return
      const range = document.createRange()
      range.setStart(text, 0)
      range.setEnd(text, 1)
      const charRect = range.getBoundingClientRect()
      const boardRect = el.getBoundingClientRect()
      const lineHeight = Math.max(charRect.height, 24)
      const bottom = Math.max(lineHeight, el.clientHeight - lineHeight)
      if (charRect.bottom > boardRect.top + bottom) {
        el.scrollTop += charRect.bottom - boardRect.top - bottom
      } else if (charRect.top < boardRect.top) {
        el.scrollTop += charRect.top - boardRect.top
      }
    })
  }

  check (index: number, input: string, target: string, words: Array<Word>): void {
    const length = target.length
    const targetWords = target.split('')
    const inputWords = input.split('')
    let lastCorrect = targetWords[0] === inputWords[0]
    let text = ''

    inputWords.forEach((v, i) => {
      if (i >= length) {
        return
      }

      const target = targetWords[i]
      const correct = v === target

      if (correct !== lastCorrect) {
        words.push(new Word(index + i - text.length, text, lastCorrect ? 'correct' : 'error'))
        text = ''
        lastCorrect = correct
      }
      text = text.concat(target)
    })

    if (text.length > 0) {
      words.push(new Word(index + input.length - text.length, text, lastCorrect ? 'correct' : 'error'))
    }
  }

  addPhrase (content: string, edge: Edge<Word>, words: Array<Word>): number {
    const { from, to, value } = edge

    if (content.length <= to) {
      // 输入长度小于当前词首，未打
      words.push(value)
      return 0
    } else {
      // 输入长度大于当前词尾，已打, 否则部分已打
      const length = content.length
      const source = content.substring(to, Math.min(from, length))
      this.check(to, source, value.text, words)
      return length > from ? 0 : length
    }
  }
}
</script>

<style lang="scss">
  #article-main {
    word-break: break-all;
  }
</style>
