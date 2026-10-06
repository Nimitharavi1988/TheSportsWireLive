// "Drama" in a headline: the kind of story that gets shared and argued about.
// On 2026-10-03 one Facebook reel about an officials' ruling on a final-second
// field goal got 28,742 plays — about 75% of the main Page's reel plays that
// week — while the typical reel got 15. Reels are ranked with a boost for these
// stories (candidate ORDER only: nothing is excluded, caps are unchanged).
//
// Only the headline's own words count; nothing is inferred or invented.
const GROUPS: RegExp[] = [
  // Officiating
  /\b(officials? ruled|referees?|umpires?|var|overturn\w*|disallow\w*|blown call|bad call|controvers\w*|robbed|howler|wrongly)\b/i,
  // Conflict
  /\b(slams?(?!\s+(?:a|an|the|his|her|\d))|blasts?|fires? back|rips?|torches|calls? out|feud|spat|row|clash\w*|heated|outburst|meltdown|storms? out|ejected|brawl|fight|snub\w*|backlash|outrage\w*|furious)\b/i,
  // Discipline and scandal
  /\b(suspend\w*|banned?|fined?|sanction\w*|investigat\w*|scandal|accus\w*|allegation\w*|arrest\w*|disqualif\w*|punish\w*|probe)\b/i,
  // Shock or dramatic finish
  /\b(last[- ]second|final[- ]second|buzzer[- ]beater|walk[- ]off|stunn\w*|shock\w*|upset|miracle|thriller|chaos|collapse|implod\w*|comeback (?:win|victory)|dramatic|heartbreak\w*|unbelievable|historic)\b/i,
];

// How many kinds of drama the headline has, 0 to 4.
export function dramaGroups(title: string): number {
  return GROUPS.filter((re) => re.test(title)).length;
}

// Points added to a story's ranking score (Article.trendingScore is roughly 18-100):
// 20 for one kind of drama, 40 for two or more.
export function dramaBoost(title: string): number {
  return 20 * Math.min(2, dramaGroups(title));
}
