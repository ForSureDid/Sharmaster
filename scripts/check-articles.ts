import { db } from '../lib/db'

async function main() {
  const samples = ['6231132', '6231133', '0156', '0157', '3111', '38016', '6230982']
  const items = await db.stockItem.findMany({ where: { article: { in: samples } }, select: { id: true, article: true, name: true } })
  console.log(JSON.stringify(items, null, 2))
  const total = await db.stockItem.count()
  const withArticle = await db.stockItem.count({ where: { article: { not: null } } })
  console.log(`Total StockItems: ${total}, with article: ${withArticle}`)
  await db.$disconnect()
}
main()
