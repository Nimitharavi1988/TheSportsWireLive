import { db } from "../src/lib/db";
const RSS_SOURCES = ["BBC Sport", "The Guardian", "Sky Sports", "ESPN Cricinfo", "ESPN"];
async function main() {
  for (const cat of ["basketball", "baseball", "athletics"]) {
    const published = await db.article.findMany({
      where: { status: "published", category: cat },
      select: { title: true, sourceName: true },
    });
    const rss = published.filter(a => RSS_SOURCES.includes(a.sourceName));
    console.log(`${cat}: ${published.length} published total, ${rss.length} RSS-sourced (eligible for hero/brief)`);
  }
}
main().finally(() => db.$disconnect());
