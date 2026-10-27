import { KataOption, KataOptions, NewsResponse } from '@/models/articleModels'

export const selfHosted = process.env.VUE_APP_SELF_HOSTED === 'true'

async function read<T> (name: string): Promise<T> {
  const response = await fetch(`${process.env.BASE_URL}practice-texts/${name}.json`)
  if (!response.ok) throw new Error('练习文本加载失败')
  return response.json()
}

export const localKataList = (): Promise<KataOptions[]> => read('list')
export const localKataOption = (id: number): Promise<KataOption> => read(String(id))

export async function localArticle (daily = false): Promise<NewsResponse> {
  const ids = await read<number[]>('articles')
  const now = new Date()
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000)
  const id = ids[daily ? day % ids.length : Math.floor(Math.random() * ids.length)]
  const article = await localKataOption(id)
  return { id, title: article.title, contentList: [article.content], timestamp: now.getTime(), utime: now.toISOString() }
}
