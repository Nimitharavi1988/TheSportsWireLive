/**
 * Curated player quotes for the "In Their Words" homepage section.
 *
 * Deliberately small and conservative — a lot of "famous sports quotes"
 * circulating online are misattributed or reworded. Every quote here was
 * checked against Wikiquote and/or cross-referenced across independent
 * sources before inclusion, not pulled from memory alone. Add to this list
 * only after the same verification, not by recalling a quote that "sounds
 * right."
 */
export interface PlayerQuote {
  quote: string;
  name: string;
  context?: string; // when/where said, only included if confidently sourced
}

export const PLAYER_QUOTES: PlayerQuote[] = [
  {
    quote:
      "Success is no accident. It is hard work, perseverance, learning, studying, sacrifice and most of all, love of what you are doing or learning to do.",
    name: "Pelé",
    context: "Pelé: My Life and the Beautiful Game",
  },
  {
    quote: "Every disadvantage has its advantage.",
    name: "Johan Cruyff",
  },
  {
    quote: "A little with the head of Maradona, and a little with the hand of God.",
    name: "Diego Maradona",
    context: "on his 1986 World Cup goal against England",
  },
  {
    quote:
      "Barcelona gave me everything, they took a chance on me when nobody else would. I never have any desire to play for anybody else.",
    name: "Lionel Messi",
    context: "2015",
  },
  {
    quote: "Cricket is the most important thing to me, so the rest of it pales in comparison.",
    name: "Virat Kohli",
  },
  {
    quote:
      "I hate losing and cricket being my first love, once I enter the ground it's a different zone altogether and that hunger for winning is always there.",
    name: "Sachin Tendulkar",
  },
];
