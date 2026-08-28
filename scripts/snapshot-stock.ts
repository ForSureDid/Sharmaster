// Daily point-in-time copy of every non-hidden OnecStockItem.stock into
// StockSnapshot. Run once a day via launchd (see
// ~/Library/LaunchAgents/kz.sharmaster.stock-snapshot.plist) — day-over-day
// drops in this table are the input to lib/reorderReport.ts's reorder
// recommendations, since 1C stock reflects real warehouse consumption
// regardless of sale channel (site vs. offline/1C).
import * as dotenv from 'dotenv'
dotenv.config()

const RETENTION_DAYS = 60

async function main() {
  const { db } = await import('../lib/db')

  const items = await db.onecStockItem.findMany({
    where: { isHidden: false },
    select: { id: true, stock: true },
  })

  const now = new Date()
  const { count } = await db.stockSnapshot.createMany({
    data: items.map((it) => ({ onecStockItemId: it.id, stock: it.stock, capturedAt: now })),
  })
  console.log(`Snapshot: ${count} rows written at ${now.toISOString()}`)

  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const { count: pruned } = await db.stockSnapshot.deleteMany({ where: { capturedAt: { lt: cutoff } } })
  console.log(`Pruned ${pruned} snapshots older than ${RETENTION_DAYS} days`)

  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
