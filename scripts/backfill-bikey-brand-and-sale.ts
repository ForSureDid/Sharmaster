// One-off backfill for the "БиКей" homepage sale banner (-25% на всю
// шелкографию BK Balloons): 1C never populated OnecStockItem.brand for these
// rows (the brand only appears as a name prefix, "БиКей Шар 12\" ..."), so
// the catalog's brand filter (/catalog?brand=БиКей) found nothing and there
// was no way to apply a brand-wide sale. This sets brand="БиКей" and
// onSale/salePercent=25 on every matching row — same convention as every
// other branded banner/sale in the catalog.
import { db } from "../lib/db";

async function main() {
  const result = await db.onecStockItem.updateMany({
    where: { isHidden: false, name: { startsWith: "БиКей", mode: "insensitive" } },
    data: { brand: "БиКей", onSale: true, salePercent: 25 },
  });
  console.log("updated rows:", result.count);

  const check = await db.onecStockItem.count({ where: { brand: "БиКей", isHidden: false, onSale: true, salePercent: 25 } });
  console.log("verified brand=БиКей, onSale, 25%:", check);

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
