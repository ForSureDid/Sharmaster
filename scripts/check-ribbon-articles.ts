import { db } from '../lib/db'

async function main() {
  const articles = process.env.ARTICLES?.split(',') ?? []
  console.log(`Total articles from files: ${articles.length}`)
  
  const found = await db.stockItem.findMany({
    where: { article: { in: articles } },
    select: { id: true, article: true, name: true, imageUrl: true }
  })
  console.log(`Found in DB: ${found.length}`)
  console.log(`Missing from DB: ${articles.length - found.length}`)
  console.log('\nSample found:')
  found.slice(0, 5).forEach(i => console.log(` ${i.article}: ${i.name} | hasImage: ${!!i.imageUrl}`))
  
  await db.$disconnect()
}
main()
