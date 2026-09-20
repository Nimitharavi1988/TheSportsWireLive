/**
 * Single source of truth for tracked star players — used both to decide
 * which RSS stories get auto-highlighted (page.tsx) and to power each
 * player's dedicated page (/player/[slug]). Keeping one list avoids the
 * two ever drifting apart. Living config — add names as gaps are found.
 */
export interface TrackedPlayer {
  slug: string;
  name: string; // full name, used for the Wikipedia/Wikimedia lookup
  searchTerms: string[]; // substrings matched against article titles (case-insensitive)
  sport: "football" | "cricket" | "american-football" | "baseball" | "basketball"; // used to scope the player page's Standings widget (no standings data exists for cricket/NFL/MLB/NBA on this API tier) and to tag the player-news search item's category (playerNewsFeeds.ts)
  // ESPN Cricinfo's numeric player ID (the trailing number in
  // espncricinfo.com/cricketers/{slug}-{id}) — cricket players only. Lets
  // cricinfoPlayerFeeds.ts pull that player's own official RSS feed
  // (real article snippets, direct article URLs) instead of relying solely
  // on the per-player Google News search, whose links can't be resolved to
  // real article text (see articleTextExtractor.ts's Google News finding).
  cricinfoPlayerId?: number;
}

export const TRACKED_PLAYERS: TrackedPlayer[] = [
  // Football — current
  { slug: "messi", name: "Lionel Messi", searchTerms: ["Messi"], sport: "football" },
  { slug: "ronaldo", name: "Cristiano Ronaldo", searchTerms: ["Ronaldo"], sport: "football" },
  { slug: "mbappe", name: "Kylian Mbappé", searchTerms: ["Mbapp"], sport: "football" },
  { slug: "haaland", name: "Erling Haaland", searchTerms: ["Haaland"], sport: "football" },
  { slug: "neymar", name: "Neymar", searchTerms: ["Neymar"], sport: "football" },
  { slug: "vinicius-junior", name: "Vinícius Júnior", searchTerms: ["Vinicius", "Vinícius"], sport: "football" },
  { slug: "jude-bellingham", name: "Jude Bellingham", searchTerms: ["Bellingham"], sport: "football" },
  { slug: "mohamed-salah", name: "Mohamed Salah", searchTerms: ["Salah"], sport: "football" },
  { slug: "harry-kane", name: "Harry Kane", searchTerms: ["Kane"], sport: "football" },
  { slug: "kevin-de-bruyne", name: "Kevin De Bruyne", searchTerms: ["De Bruyne"], sport: "football" },
  { slug: "luka-modric", name: "Luka Modrić", searchTerms: ["Modric", "Modrić"], sport: "football" },
  { slug: "bukayo-saka", name: "Bukayo Saka", searchTerms: ["Saka"], sport: "football" },
  { slug: "phil-foden", name: "Phil Foden", searchTerms: ["Foden"], sport: "football" },
  { slug: "jamal-musiala", name: "Jamal Musiala", searchTerms: ["Musiala"], sport: "football" },
  { slug: "pedri", name: "Pedri", searchTerms: ["Pedri"], sport: "football" },
  { slug: "robert-lewandowski", name: "Robert Lewandowski", searchTerms: ["Lewandowski"], sport: "football" },
  // Found via nameGapReport.ts (2026-09-12): 4 mentions in 2 weeks.
  { slug: "rodrigo-de-paul", name: "Rodrigo De Paul", searchTerms: ["De Paul"], sport: "football" },
  // Found via nameGapReport.ts (2026-09-12): 3 mentions in 2 weeks.
  { slug: "michael-olise", name: "Michael Olise", searchTerms: ["Olise"], sport: "football" },
  // "Martinez" alone is a very common surname (several other tracked
  // players' teams have one) — "Lautaro" (his first name, how he's usually
  // referred to in headlines) is distinctive enough on its own.
  { slug: "lautaro-martinez", name: "Lautaro Martínez", searchTerms: ["Lautaro"], sport: "football" },
  // "Rice" alone is a common word (the food) — full name needed.
  { slug: "declan-rice", name: "Declan Rice", searchTerms: ["Declan Rice"], sport: "football" },
  // "Son" (as in Son Heung-min, near-universally just "Son" in English
  // headlines) is far too common an English word to match safely, and his
  // full name rarely appears in headlines — deliberately left out rather
  // than risking a flood of false positives or a term that would barely
  // ever match. Same reasoning as skipping "Rodri" (collides with the
  // common name "Rodrigo") for this batch.
  // Found via nameGapReport.ts (2026-09-19): 3 mentions in 2 weeks each.
  // Full names used — "Carrick"/"Fernandes" alone are both too generic
  // (other tracked/common surnames collide) to match safely on their own.
  { slug: "michael-carrick", name: "Michael Carrick", searchTerms: ["Michael Carrick"], sport: "football" },
  { slug: "bruno-fernandes", name: "Bruno Fernandes", searchTerms: ["Bruno Fernandes"], sport: "football" },
  // Requested batch (2026-09-19) -- see baseball section above for the
  // same reasoning. Full names throughout; "Palmer"/"Wirtz" alone are
  // common enough surnames to need it.
  { slug: "virgil-van-dijk", name: "Virgil van Dijk", searchTerms: ["Virgil van Dijk", "van Dijk"], sport: "football" },
  { slug: "cole-palmer", name: "Cole Palmer", searchTerms: ["Cole Palmer"], sport: "football" },
  { slug: "florian-wirtz", name: "Florian Wirtz", searchTerms: ["Florian Wirtz"], sport: "football" },
  { slug: "ousmane-dembele", name: "Ousmane Dembélé", searchTerms: ["Dembélé", "Dembele"], sport: "football" },
  // Football — recently retired / legends still regularly in the news
  { slug: "ronaldinho", name: "Ronaldinho", searchTerms: ["Ronaldinho"], sport: "football" },
  { slug: "zinedine-zidane", name: "Zinédine Zidane", searchTerms: ["Zidane"], sport: "football" },
  { slug: "diego-maradona", name: "Diego Maradona", searchTerms: ["Maradona"], sport: "football" },
  { slug: "pele", name: "Pelé", searchTerms: ["Pelé", "Pele"], sport: "football" },
  { slug: "david-beckham", name: "David Beckham", searchTerms: ["Beckham"], sport: "football" },
  { slug: "andres-iniesta", name: "Andrés Iniesta", searchTerms: ["Iniesta"], sport: "football" },
  { slug: "johan-cruyff", name: "Johan Cruyff", searchTerms: ["Cruyff"], sport: "football" },
  { slug: "franz-beckenbauer", name: "Franz Beckenbauer", searchTerms: ["Beckenbauer"], sport: "football" },
  // "Best" alone is far too common a word for a substring match — needs
  // the full name to avoid matching every "best player"/"best goal" story.
  { slug: "george-best", name: "George Best", searchTerms: ["George Best"], sport: "football" },
  { slug: "paolo-maldini", name: "Paolo Maldini", searchTerms: ["Maldini"], sport: "football" },
  { slug: "xavi-hernandez", name: "Xavi Hernández", searchTerms: ["Xavi"], sport: "football" },
  { slug: "roberto-baggio", name: "Roberto Baggio", searchTerms: ["Baggio"], sport: "football" },
  // Cricket — current
  { slug: "virat-kohli", name: "Virat Kohli", searchTerms: ["Kohli"], sport: "cricket", cricinfoPlayerId: 253802 },
  { slug: "ben-stokes", name: "Ben Stokes", searchTerms: ["Ben Stokes"], sport: "cricket", cricinfoPlayerId: 311158 },
  { slug: "babar-azam", name: "Babar Azam", searchTerms: ["Babar Azam"], sport: "cricket", cricinfoPlayerId: 348144 },
  { slug: "rohit-sharma", name: "Rohit Sharma", searchTerms: ["Rohit Sharma"], sport: "cricket", cricinfoPlayerId: 34102 },
  { slug: "joe-root", name: "Joe Root", searchTerms: ["Joe Root"], sport: "cricket", cricinfoPlayerId: 303669 },
  { slug: "steve-smith", name: "Steve Smith", searchTerms: ["Steve Smith"], sport: "cricket", cricinfoPlayerId: 267192 },
  { slug: "sunil-narine", name: "Sunil Narine", searchTerms: ["Narine"], sport: "cricket", cricinfoPlayerId: 230558 },
  { slug: "sanju-samson", name: "Sanju Samson", searchTerms: ["Samson"], sport: "cricket", cricinfoPlayerId: 425943 },
  { slug: "jasprit-bumrah", name: "Jasprit Bumrah", searchTerms: ["Bumrah"], sport: "cricket", cricinfoPlayerId: 625383 },
  { slug: "jos-buttler", name: "Jos Buttler", searchTerms: ["Buttler"], sport: "cricket", cricinfoPlayerId: 308967 },
  // "Pant"/"Gill"/"Rahul"/"Warner"/"Head"/"Khan" are common English words or
  // surnames on their own — full name needed, same reasoning as "George
  // Best"/"Shane Warne" above.
  { slug: "rishabh-pant", name: "Rishabh Pant", searchTerms: ["Rishabh Pant"], sport: "cricket", cricinfoPlayerId: 931581 },
  { slug: "shubman-gill", name: "Shubman Gill", searchTerms: ["Shubman Gill"], sport: "cricket", cricinfoPlayerId: 1070173 },
  { slug: "kl-rahul", name: "KL Rahul", searchTerms: ["KL Rahul"], sport: "cricket", cricinfoPlayerId: 422108 },
  { slug: "david-warner", name: "David Warner", searchTerms: ["David Warner"], sport: "cricket", cricinfoPlayerId: 219889 },
  { slug: "travis-head", name: "Travis Head", searchTerms: ["Travis Head"], sport: "cricket", cricinfoPlayerId: 530011 },
  { slug: "rashid-khan", name: "Rashid Khan", searchTerms: ["Rashid Khan"], sport: "cricket", cricinfoPlayerId: 793463 },
  { slug: "kane-williamson", name: "Kane Williamson", searchTerms: ["Kane Williamson"], sport: "cricket", cricinfoPlayerId: 277906 },
  { slug: "pat-cummins", name: "Pat Cummins", searchTerms: ["Pat Cummins"], sport: "cricket", cricinfoPlayerId: 489889 },
  { slug: "tim-david", name: "Tim David", searchTerms: ["Tim David"], sport: "cricket", cricinfoPlayerId: 892749 },
  // Added 2026-09-20 (explicit request, real article gap): India's current
  // T20I fastest-century record holder plus the two rivals he was directly
  // compared against in that same article (Salt, Allen) — all three
  // Cricinfo IDs WebSearch-verified live against espncricinfo.com.
  { slug: "abhishek-sharma", name: "Abhishek Sharma", searchTerms: ["Abhishek Sharma"], sport: "cricket", cricinfoPlayerId: 1070183 },
  { slug: "phil-salt", name: "Phil Salt", searchTerms: ["Phil Salt"], sport: "cricket", cricinfoPlayerId: 669365 },
  { slug: "finn-allen", name: "Finn Allen", searchTerms: ["Finn Allen"], sport: "cricket", cricinfoPlayerId: 959759 },
  // Added 2026-09-20 (explicit request): full playing XIs for the
  // Zimbabwe vs Australia 3rd ODI (Harare) — every Cricinfo ID
  // WebSearch-verified live against espncricinfo.com/cricketers pages, not
  // taken from the scorecard fetch alone. Common surnames (Evans, Bartlett,
  // Ellis, Peake) kept to full-name search terms only to avoid collisions;
  // distinctive surnames (Madhevere, Masuku, Cremer, Muzarabani, Connolly,
  // Inglis, Renshaw, Zampa) added as a second term.
  { slug: "brian-bennett", name: "Brian Bennett", searchTerms: ["Brian Bennett"], sport: "cricket", cricinfoPlayerId: 1071484 },
  { slug: "ben-curran", name: "Ben Curran", searchTerms: ["Ben Curran"], sport: "cricket", cricinfoPlayerId: 910695 },
  { slug: "innocent-kaia", name: "Innocent Kaia", searchTerms: ["Innocent Kaia"], sport: "cricket", cricinfoPlayerId: 465327 },
  { slug: "brendan-taylor", name: "Brendan Taylor", searchTerms: ["Brendan Taylor"], sport: "cricket", cricinfoPlayerId: 55814 },
  { slug: "craig-ervine", name: "Craig Ervine", searchTerms: ["Craig Ervine"], sport: "cricket", cricinfoPlayerId: 55412 },
  { slug: "sikandar-raza", name: "Sikandar Raza", searchTerms: ["Sikandar Raza"], sport: "cricket", cricinfoPlayerId: 299572 },
  { slug: "wessly-madhevere", name: "Wessly Madhevere", searchTerms: ["Wessly Madhevere", "Madhevere"], sport: "cricket", cricinfoPlayerId: 938959 },
  { slug: "brad-evans", name: "Brad Evans", searchTerms: ["Brad Evans"], sport: "cricket", cricinfoPlayerId: 696127 },
  { slug: "ernest-masuku", name: "Ernest Masuku", searchTerms: ["Ernest Masuku", "Masuku"], sport: "cricket", cricinfoPlayerId: 728085 },
  { slug: "graeme-cremer", name: "Graeme Cremer", searchTerms: ["Graeme Cremer", "Cremer"], sport: "cricket", cricinfoPlayerId: 55346 },
  { slug: "blessing-muzarabani", name: "Blessing Muzarabani", searchTerms: ["Blessing Muzarabani", "Muzarabani"], sport: "cricket", cricinfoPlayerId: 827051 },
  { slug: "mitch-marsh", name: "Mitch Marsh", searchTerms: ["Mitch Marsh", "Mitchell Marsh"], sport: "cricket", cricinfoPlayerId: 272450 },
  { slug: "cooper-connolly", name: "Cooper Connolly", searchTerms: ["Cooper Connolly", "Connolly"], sport: "cricket", cricinfoPlayerId: 1210488 },
  { slug: "josh-inglis", name: "Josh Inglis", searchTerms: ["Josh Inglis", "Inglis"], sport: "cricket", cricinfoPlayerId: 662235 },
  { slug: "alex-carey", name: "Alex Carey", searchTerms: ["Alex Carey"], sport: "cricket", cricinfoPlayerId: 326434 },
  { slug: "matt-renshaw", name: "Matt Renshaw", searchTerms: ["Matt Renshaw", "Renshaw"], sport: "cricket", cricinfoPlayerId: 722303 },
  { slug: "ollie-peake", name: "Ollie Peake", searchTerms: ["Ollie Peake"], sport: "cricket", cricinfoPlayerId: 1418371 },
  { slug: "xavier-bartlett", name: "Xavier Bartlett", searchTerms: ["Xavier Bartlett"], sport: "cricket", cricinfoPlayerId: 1050545 },
  { slug: "nathan-ellis", name: "Nathan Ellis", searchTerms: ["Nathan Ellis"], sport: "cricket", cricinfoPlayerId: 826915 },
  { slug: "adam-zampa", name: "Adam Zampa", searchTerms: ["Zampa"], sport: "cricket", cricinfoPlayerId: 379504 },
  { slug: "spencer-johnson", name: "Spencer Johnson", searchTerms: ["Spencer Johnson"], sport: "cricket", cricinfoPlayerId: 1123718 },
  // Found via nameGapReport.ts (2026-09-12): 3 mentions in 2 weeks, all
  // referring to him as just "Boult" — no collision found for that surname
  // alone.
  { slug: "trent-boult", name: "Trent Boult", searchTerms: ["Boult"], sport: "cricket", cricinfoPlayerId: 277912 },
  // "Pandya" alone is ambiguous between Hardik and his brother Krunal, both
  // active internationals — full name needed to pick the right one.
  { slug: "hardik-pandya", name: "Hardik Pandya", searchTerms: ["Hardik Pandya"], sport: "cricket", cricinfoPlayerId: 625371 },
  // "Surya" alone is too common an Indian name-root; "Suryakumar" is
  // distinctive enough on its own.
  { slug: "suryakumar-yadav", name: "Suryakumar Yadav", searchTerms: ["Suryakumar"], sport: "cricket", cricinfoPlayerId: 446507 },
  { slug: "ishan-kishan", name: "Ishan Kishan", searchTerms: ["Ishan Kishan"], sport: "cricket", cricinfoPlayerId: 720471 },
  // Both spellings appear regularly in real headlines — Cricinfo's own
  // slug uses "Sooryavanshi", but plenty of outlets (including gulfnews.com)
  // spell it "Suryavanshi".
  { slug: "vaibhav-sooryavanshi", name: "Vaibhav Sooryavanshi", searchTerms: ["Sooryavanshi", "Suryavanshi"], sport: "cricket", cricinfoPlayerId: 1408688 },
  // Real gap found (2026-09-12): 4 separate articles in one week quoting
  // him on India's XI selection, ex-captain, currently a selector/mentor —
  // recurring source of real headlines with no tracking at all.
  { slug: "ajinkya-rahane", name: "Ajinkya Rahane", searchTerms: ["Rahane"], sport: "cricket", cricinfoPlayerId: 277916 },
  // Real gap (2026-09-12): India's current white-ball captain, already
  // appearing in real headlines ("Shreyas Iyer on tough start to
  // captaincy") with zero tracking — arguably a bigger miss than Rahane.
  { slug: "shreyas-iyer", name: "Shreyas Iyer", searchTerms: ["Shreyas Iyer"], sport: "cricket", cricinfoPlayerId: 642519 },
  // Found via nameGapReport.ts (2026-09-19): 4 mentions in 2 weeks. Full
  // name used — "Cox" alone is far too generic a surname on its own.
  { slug: "jordan-cox", name: "Jordan Cox", searchTerms: ["Jordan Cox"], sport: "cricket", cricinfoPlayerId: 1112537 },
  // Requested batch (2026-09-19): major current internationals missing
  // despite being globally prominent names, not surfaced by
  // nameGapReport.ts's own 2-week trending window. All Cricinfo IDs
  // verified directly against real ESPN Cricinfo profiles. Full names used
  // throughout — several of these surnames are common enough or collide
  // with another real player (e.g. "Afridi" alone would match Shahid
  // Afridi too; "Rizwan" alone matches at least two other real
  // internationals) to need the full name for a safe match.
  { slug: "mohammad-rizwan", name: "Mohammad Rizwan", searchTerms: ["Mohammad Rizwan"], sport: "cricket", cricinfoPlayerId: 323389 },
  { slug: "shaheen-afridi", name: "Shaheen Afridi", searchTerms: ["Shaheen Afridi"], sport: "cricket", cricinfoPlayerId: 1072470 },
  { slug: "mitchell-starc", name: "Mitchell Starc", searchTerms: ["Mitchell Starc"], sport: "cricket", cricinfoPlayerId: 311592 },
  { slug: "yashasvi-jaiswal", name: "Yashasvi Jaiswal", searchTerms: ["Yashasvi Jaiswal"], sport: "cricket", cricinfoPlayerId: 1151278 },
  { slug: "quinton-de-kock", name: "Quinton de Kock", searchTerms: ["Quinton de Kock"], sport: "cricket", cricinfoPlayerId: 379143 },
  { slug: "glenn-maxwell", name: "Glenn Maxwell", searchTerms: ["Glenn Maxwell"], sport: "cricket", cricinfoPlayerId: 325026 },
  { slug: "shakib-al-hasan", name: "Shakib Al Hasan", searchTerms: ["Shakib Al Hasan"], sport: "cricket", cricinfoPlayerId: 56143 },
  { slug: "marnus-labuschagne", name: "Marnus Labuschagne", searchTerms: ["Marnus Labuschagne"], sport: "cricket", cricinfoPlayerId: 787987 },
  { slug: "wanindu-hasaranga", name: "Wanindu Hasaranga", searchTerms: ["Wanindu Hasaranga"], sport: "cricket", cricinfoPlayerId: 784379 },
  // Cricket — legends (previously missing entirely — football had 6
  // legends tracked, cricket had none)
  { slug: "sachin-tendulkar", name: "Sachin Tendulkar", searchTerms: ["Tendulkar"], sport: "cricket", cricinfoPlayerId: 35320 },
  { slug: "ms-dhoni", name: "MS Dhoni", searchTerms: ["Dhoni"], sport: "cricket", cricinfoPlayerId: 28081 },
  { slug: "ricky-ponting", name: "Ricky Ponting", searchTerms: ["Ponting"], sport: "cricket", cricinfoPlayerId: 7133 },
  { slug: "sunil-gavaskar", name: "Sunil Gavaskar", searchTerms: ["Gavaskar"], sport: "cricket", cricinfoPlayerId: 28794 },
  { slug: "muttiah-muralitharan", name: "Muttiah Muralitharan", searchTerms: ["Muralitharan"], sport: "cricket", cricinfoPlayerId: 49636 },
  { slug: "jacques-kallis", name: "Jacques Kallis", searchTerms: ["Kallis"], sport: "cricket", cricinfoPlayerId: 45789 },
  { slug: "ab-de-villiers", name: "AB de Villiers", searchTerms: ["de Villiers"], sport: "cricket", cricinfoPlayerId: 44936 },
  // Found via nameGapReport.ts (2026-09-12): 3 mentions in 2 weeks. Full
  // name used defensively — no confirmed collision for "Akhtar" alone, but
  // no real headline example confirmed it's safe either.
  { slug: "shoaib-akhtar", name: "Shoaib Akhtar", searchTerms: ["Shoaib Akhtar"], sport: "cricket", cricinfoPlayerId: 42655 },
  // "Warne"/"Lara"/"Richards"/"Akram" are common enough English words or
  // surnames on their own that the full name is needed to avoid false
  // matches — same reasoning as "George Best" above.
  { slug: "shane-warne", name: "Shane Warne", searchTerms: ["Shane Warne"], sport: "cricket", cricinfoPlayerId: 8166 },
  { slug: "brian-lara", name: "Brian Lara", searchTerms: ["Brian Lara"], sport: "cricket", cricinfoPlayerId: 52337 },
  { slug: "viv-richards", name: "Viv Richards", searchTerms: ["Viv Richards"], sport: "cricket", cricinfoPlayerId: 52812 },
  { slug: "wasim-akram", name: "Wasim Akram", searchTerms: ["Wasim Akram"], sport: "cricket", cricinfoPlayerId: 43547 },
  { slug: "kapil-dev", name: "Kapil Dev", searchTerms: ["Kapil Dev"], sport: "cricket", cricinfoPlayerId: 30028 },

  // NFL — current stars. Zero NFL players were tracked before this (only
  // football/cricket), which meant the per-player Google News search
  // pipeline that meaningfully expands coverage for those two sports
  // contributed nothing at all to NFL — a real, confirmed gap alongside NFL
  // having just 1 RSS feed vs football's 3 / cricket's 4 (rssFeeds.ts).
  { slug: "patrick-mahomes", name: "Patrick Mahomes", searchTerms: ["Mahomes"], sport: "american-football" },
  // "Allen"/"Jackson"/"Jefferson"/"Hurts"/"Bosa"/"Herbert" are all common
  // enough as surnames (or, for "Hurts", an ordinary English word) that
  // multiple current NFL players or unrelated headlines could match — full
  // name needed, same reasoning as "Declan Rice"/"George Best" above.
  { slug: "josh-allen", name: "Josh Allen", searchTerms: ["Josh Allen"], sport: "american-football" },
  { slug: "lamar-jackson", name: "Lamar Jackson", searchTerms: ["Lamar Jackson"], sport: "american-football" },
  { slug: "justin-jefferson", name: "Justin Jefferson", searchTerms: ["Justin Jefferson"], sport: "american-football" },
  { slug: "jalen-hurts", name: "Jalen Hurts", searchTerms: ["Jalen Hurts"], sport: "american-football" },
  { slug: "nick-bosa", name: "Nick Bosa", searchTerms: ["Nick Bosa"], sport: "american-football" },
  { slug: "justin-herbert", name: "Justin Herbert", searchTerms: ["Justin Herbert"], sport: "american-football" },
  { slug: "christian-mccaffrey", name: "Christian McCaffrey", searchTerms: ["McCaffrey"], sport: "american-football" },
  // "Burrow" alone is a common English word (an animal's burrow) — full
  // name needed, same reasoning as "Jalen Hurts" above.
  { slug: "joe-burrow", name: "Joe Burrow", searchTerms: ["Joe Burrow"], sport: "american-football" },
  { slug: "micah-parsons", name: "Micah Parsons", searchTerms: ["Micah Parsons"], sport: "american-football" },
  { slug: "travis-kelce", name: "Travis Kelce", searchTerms: ["Travis Kelce"], sport: "american-football" },
  { slug: "tyreek-hill", name: "Tyreek Hill", searchTerms: ["Tyreek Hill"], sport: "american-football" },
  { slug: "ceedee-lamb", name: "CeeDee Lamb", searchTerms: ["CeeDee Lamb"], sport: "american-football" },
  { slug: "aaron-rodgers", name: "Aaron Rodgers", searchTerms: ["Aaron Rodgers"], sport: "american-football" },
  // Found via nameGapReport.ts (2026-09-19): 5 and 3 mentions in 2 weeks.
  { slug: "kyler-murray", name: "Kyler Murray", searchTerms: ["Kyler Murray"], sport: "american-football" },
  { slug: "zay-flowers", name: "Zay Flowers", searchTerms: ["Zay Flowers"], sport: "american-football" },
  // Requested batch (2026-09-19) -- see baseball section above for the
  // same reasoning. "Chase" alone is far too common a word/surname to
  // match safely — full name needed.
  { slug: "jamarr-chase", name: "Ja'Marr Chase", searchTerms: ["Ja'Marr Chase", "JaMarr Chase"], sport: "american-football" },
  { slug: "saquon-barkley", name: "Saquon Barkley", searchTerms: ["Saquon Barkley"], sport: "american-football" },
  { slug: "myles-garrett", name: "Myles Garrett", searchTerms: ["Myles Garrett"], sport: "american-football" },
  { slug: "cj-stroud", name: "C.J. Stroud", searchTerms: ["CJ Stroud", "C.J. Stroud"], sport: "american-football" },
  // Legends.
  { slug: "tom-brady", name: "Tom Brady", searchTerms: ["Tom Brady"], sport: "american-football" },
  { slug: "peyton-manning", name: "Peyton Manning", searchTerms: ["Peyton Manning"], sport: "american-football" },

  // MLB — current stars, tracked from day one alongside the new mlbData.ts
  // section (mlbData.ts) rather than left as a gap the way NFL originally
  // was. Distinctive single surnames used where safe; common-word/common-
  // surname names paired with the full name, same reasoning as above.
  { slug: "shohei-ohtani", name: "Shohei Ohtani", searchTerms: ["Ohtani"], sport: "baseball" },
  { slug: "aaron-judge", name: "Aaron Judge", searchTerms: ["Aaron Judge"], sport: "baseball" },
  { slug: "mike-trout", name: "Mike Trout", searchTerms: ["Mike Trout"], sport: "baseball" },
  { slug: "mookie-betts", name: "Mookie Betts", searchTerms: ["Mookie Betts"], sport: "baseball" },
  { slug: "ronald-acuna-jr", name: "Ronald Acuña Jr.", searchTerms: ["Acuña", "Acuna"], sport: "baseball" },
  { slug: "juan-soto", name: "Juan Soto", searchTerms: ["Juan Soto"], sport: "baseball" },
  { slug: "bryce-harper", name: "Bryce Harper", searchTerms: ["Bryce Harper"], sport: "baseball" },
  { slug: "freddie-freeman", name: "Freddie Freeman", searchTerms: ["Freddie Freeman"], sport: "baseball" },
  { slug: "fernando-tatis-jr", name: "Fernando Tatis Jr.", searchTerms: ["Tatis"], sport: "baseball" },
  { slug: "gerrit-cole", name: "Gerrit Cole", searchTerms: ["Gerrit Cole"], sport: "baseball" },
  // Requested batch (2026-09-19): major current stars missing despite
  // being globally prominent, not surfaced by nameGapReport.ts's own
  // 2-week trending window. Full names throughout -- "Rodriguez" is an
  // extremely common surname on its own.
  { slug: "vladimir-guerrero-jr", name: "Vladimir Guerrero Jr.", searchTerms: ["Vladimir Guerrero Jr", "Guerrero Jr"], sport: "baseball" },
  { slug: "corbin-burnes", name: "Corbin Burnes", searchTerms: ["Corbin Burnes"], sport: "baseball" },
  { slug: "julio-rodriguez", name: "Julio Rodríguez", searchTerms: ["Julio Rodriguez", "Julio Rodríguez"], sport: "baseball" },
  { slug: "bobby-witt-jr", name: "Bobby Witt Jr.", searchTerms: ["Bobby Witt"], sport: "baseball" },

  // NBA — current stars, same reasoning as MLB above (tracked from day one
  // alongside nbaData.ts).
  { slug: "lebron-james", name: "LeBron James", searchTerms: ["LeBron"], sport: "basketball" },
  { slug: "stephen-curry", name: "Stephen Curry", searchTerms: ["Stephen Curry", "Steph Curry"], sport: "basketball" },
  { slug: "kevin-durant", name: "Kevin Durant", searchTerms: ["Durant"], sport: "basketball" },
  { slug: "giannis-antetokounmpo", name: "Giannis Antetokounmpo", searchTerms: ["Giannis"], sport: "basketball" },
  { slug: "nikola-jokic", name: "Nikola Jokić", searchTerms: ["Jokic", "Jokić"], sport: "basketball" },
  { slug: "luka-doncic", name: "Luka Dončić", searchTerms: ["Doncic", "Dončić"], sport: "basketball" },
  { slug: "joel-embiid", name: "Joel Embiid", searchTerms: ["Embiid"], sport: "basketball" },
  { slug: "jayson-tatum", name: "Jayson Tatum", searchTerms: ["Jayson Tatum"], sport: "basketball" },
  { slug: "victor-wembanyama", name: "Victor Wembanyama", searchTerms: ["Wembanyama"], sport: "basketball" },
  { slug: "anthony-edwards", name: "Anthony Edwards", searchTerms: ["Anthony Edwards"], sport: "basketball" },
  // Requested batch (2026-09-19) -- see baseball section above for the
  // same reasoning. "Booker"/"Lillard" alone are common enough surnames
  // to need the full name.
  { slug: "kawhi-leonard", name: "Kawhi Leonard", searchTerms: ["Kawhi Leonard"], sport: "basketball" },
  { slug: "damian-lillard", name: "Damian Lillard", searchTerms: ["Damian Lillard"], sport: "basketball" },
  { slug: "devin-booker", name: "Devin Booker", searchTerms: ["Devin Booker"], sport: "basketball" },
  { slug: "shai-gilgeous-alexander", name: "Shai Gilgeous-Alexander", searchTerms: ["Gilgeous-Alexander"], sport: "basketball" },
];

// Flat list of every search term, for the homepage's auto-highlight check.
export const SUPERSTAR_SEARCH_TERMS = TRACKED_PLAYERS.flatMap((p) => p.searchTerms);

// playerNewsFeeds.ts sets RawMatchItem.knownPersonName to whichever
// player's own dedicated Google News search happened to catch a story —
// not necessarily the player the headline is actually about. Confirmed
// live: "Sanju Samson joins Rohit Sharma, KL Rahul in India's elite club"
// got Rohit Sharma's photo, because it also matched Sharma's own feed
// search, even though Samson is the real subject. A headline naming
// several tracked players almost always leads with the one it's actually
// about ("X joins Y, Z in..."), so preferring whichever tracked player's
// search term appears earliest in the title is a much better signal than
// trusting knownPersonName blindly whenever more than one name is present.
export function resolvePrimaryPlayerName(title: string, fallbackName: string): string {
  const lower = title.toLowerCase();
  let best: { name: string; index: number } | null = null;
  for (const player of TRACKED_PLAYERS) {
    for (const term of player.searchTerms) {
      const index = lower.indexOf(term.toLowerCase());
      if (index !== -1 && (!best || index < best.index)) {
        best = { name: player.name, index };
      }
    }
  }
  return best?.name ?? fallbackName;
}
