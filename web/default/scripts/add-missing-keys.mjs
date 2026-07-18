import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Enter a keyword to search articles.': 'Enter a keyword to search articles.',
    'Published articles tagged with {{tag}}': 'Published articles tagged with {{tag}}',
    'Search articles': 'Search articles',
    'Search results for "{{query}}"': 'Search results for "{{query}}"',
    'Tagged with "{{tag}}"': 'Tagged with "{{tag}}"',
  },
  zh: {
    'Enter a keyword to search articles.': '输入关键词搜索文章。',
    'Published articles tagged with {{tag}}': '标签为{{tag}}的已发布文章',
    'Search articles': '搜索文章',
    'Search results for "{{query}}"': '“{{query}}”的搜索结果',
    'Tagged with "{{tag}}"': '标签“{{tag}}”',
  },
  fr: {
    'Enter a keyword to search articles.': 'Saisissez un mot-clé pour rechercher des articles.',
    'Published articles tagged with {{tag}}': 'Articles publiés tagués avec {{tag}}',
    'Search articles': 'Rechercher des articles',
    'Search results for "{{query}}"': 'Résultats de recherche pour "{{query}}"',
    'Tagged with "{{tag}}"': 'Tagué avec "{{tag}}"',
  },
  ja: {
    'Enter a keyword to search articles.': 'キーワードを入力して記事を検索してください。',
    'Published articles tagged with {{tag}}': '{{tag}} タグの公開記事',
    'Search articles': '記事を検索',
    'Search results for "{{query}}"': '「{{query}}」の検索結果',
    'Tagged with "{{tag}}"': 'タグ「{{tag}}」',
  },
  ru: {
    'Enter a keyword to search articles.': 'Введите ключевое слово для поиска статей.',
    'Published articles tagged with {{tag}}': 'Опубликованные статьи с тегом {{tag}}',
    'Search articles': 'Поиск статей',
    'Search results for "{{query}}"': 'Результаты поиска для "{{query}}"',
    'Tagged with "{{tag}}"': 'С тегом "{{tag}}"',
  },
  vi: {
    'Enter a keyword to search articles.': 'Nhập từ khóa để tìm kiếm bài viết.',
    'Published articles tagged with {{tag}}': 'Bài viết đã xuất bản được gắn thẻ {{tag}}',
    'Search articles': 'Tìm kiếm bài viết',
    'Search results for "{{query}}"': 'Kết quả tìm kiếm cho "{{query}}"',
    'Tagged with "{{tag}}"': 'Được gắn thẻ "{{tag}}"',
  },
}

async function main() {
  let totalAdded = 0

  for (const [locale, trans] of Object.entries(newKeys)) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`)
    const json = JSON.parse(await fs.readFile(filePath, 'utf8'))

    let count = 0
    for (const [key, value] of Object.entries(trans)) {
      if (!Object.prototype.hasOwnProperty.call(json.translation, key)) {
        json.translation[key] = value
        count++
      } else if (json.translation[key] !== value) {
        json.translation[key] = value
        count++
      }
    }

    if (count > 0) {
      json.translation = Object.fromEntries(
        Object.entries(json.translation).sort(([a], [b]) => a.localeCompare(b))
      )
      await fs.writeFile(filePath, stableStringify(json), 'utf8')
    }

    console.log(`${locale}: ${count} translations applied`)
    totalAdded += count
  }

  console.log(`\nTotal: ${totalAdded} translations applied`)
}

main().catch((err) => { console.error(err); process.exitCode = 1 })
