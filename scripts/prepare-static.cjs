const fs = require('fs')
const path = require('path')

const source = path.join(__dirname, 'kata')
const output = path.join(__dirname, '..', 'public', 'practice-texts')
const groups = JSON.parse(fs.readFileSync(path.join(source, 'options.json'), 'utf8'))
const reserved = { singleFront500: 44, singleMiddle500: 45, singleEnd500: 46 }
const articles = []
let nextId = 1000
fs.mkdirSync(output, { recursive: true })
fs.copyFileSync(path.join(__dirname, '..', 'LICENSE'), path.join(output, '..', 'LICENSE.txt'))

for (const group of groups) {
  for (const item of group.children) {
    delete item.isRemote
    if (item.value === 'freeText') {
      item.id = -1
      continue
    }
    item.id = reserved[item.value] || nextId++
    const text = JSON.parse(fs.readFileSync(path.join(source, `${item.value}.json`), 'utf8'))
    if (!text.title || !text.content) throw new Error(`Empty practice text: ${item.value}`)
    fs.writeFileSync(path.join(output, `${item.id}.json`), JSON.stringify(text))
    if (group.value.startsWith('articleSet')) articles.push(item.id)
  }
}
fs.writeFileSync(path.join(output, 'list.json'), JSON.stringify(groups))
fs.writeFileSync(path.join(output, 'articles.json'), JSON.stringify(articles))
console.log(`Prepared ${groups.reduce((n, group) => n + group.children.length, 0) - 1} local practice texts.`)
