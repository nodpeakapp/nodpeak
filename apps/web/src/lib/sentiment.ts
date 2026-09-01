/**
 * Sentiment classification.
 *
 * The star rating is the primary and near-perfect signal — someone who
 * clicked one star is not happy, whatever the words say. The lexicon only
 * moves a rating that sits on the fence (3 stars), or flags a review whose
 * text contradicts its stars hard enough that a human should look.
 *
 * Deliberately dependency-free: no model download, no API call, no cold
 * start. Runs in microseconds on an Ampere core.
 */

import type { Sentiment } from "./enums";

const NEGATIVE = [
  "terrible","awful","horrible","worst","rude","scam","ripoff","rip off","fraud",
  "never again","waste","disappointed","disappointing","unprofessional","late",
  "damaged","broken","dirty","overcharged","overpriced","refund","complaint",
  "ignored","cancelled","canceled","no show","noshow","poor","bad","angry",
  "useless","incompetent","misleading","lied","avoid",
];

const POSITIVE = [
  "excellent","amazing","fantastic","perfect","great","wonderful","outstanding",
  "professional","friendly","helpful","quick","fast","recommend","recommended",
  "best","love","loved","happy","pleased","thorough","honest","fair","reliable",
  "on time","above and beyond","lifesaver","impressed","courteous","clean",
];

const NEGATORS = ["not", "no", "never", "isn't", "wasn't", "didn't", "won't", "can't", "hardly"];

function lexiconScore(text: string): number {
  const t = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ")} `;
  const words = t.trim().split(" ");
  let score = 0;

  const hit = (phrase: string, weight: number) => {
    if (!t.includes(` ${phrase} `)) return;
    // A negator in the three words before the match flips it.
    const idx = words.findIndex((_, i) => words.slice(i, i + phrase.split(" ").length).join(" ") === phrase);
    const window = idx > 0 ? words.slice(Math.max(0, idx - 3), idx) : [];
    const negated = window.some((w) => NEGATORS.includes(w));
    score += negated ? -weight : weight;
  };

  for (const p of POSITIVE) hit(p, 1);
  for (const n of NEGATIVE) hit(n, -1);
  return score;
}

export type SentimentResult = {
  sentiment: Sentiment;
  /** True when the text disagrees sharply with the stars — worth a human read. */
  conflict: boolean;
  lexiconScore: number;
};

export function classify(rating: number, comment?: string | null): SentimentResult {
  const score = comment && comment.trim() ? lexiconScore(comment) : 0;

  let sentiment: Sentiment;
  if (rating >= 4) sentiment = "POSITIVE";
  else if (rating <= 2) sentiment = "NEGATIVE";
  else {
    // 3 stars: let the words break the tie.
    sentiment = score > 0 ? "POSITIVE" : score < 0 ? "NEGATIVE" : "NEUTRAL";
  }

  const conflict =
    (rating >= 4 && score <= -2) || (rating <= 2 && score >= 2);

  return { sentiment, conflict, lexiconScore: score };
}
