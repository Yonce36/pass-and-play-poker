// handEval — 役判定とスコア比較（pure function）
import type { Card, HandRank, HandResult } from '@/types';

const RANK_VALUE: Record<string, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const HAND_RANK_STRENGTH: Record<HandRank, number> = {
  highCard: 0,
  onePair: 1,
  twoPair: 2,
  threeOfAKind: 3,
  straight: 4,
  flush: 5,
  fullHouse: 6,
  fourOfAKind: 7,
  straightFlush: 8,
};

function rankValueOf(card: Card): number {
  return RANK_VALUE[card[1]];
}

function suitOf(card: Card): string {
  return card[0];
}

/** 5枚固定の役判定。score = [役の強さ, 主ランク..., キッカー...]（SPEC 3.10） */
function evaluateFive(cards: Card[]): { handRank: HandRank; score: number[] } {
  const values = cards.map(rankValueOf).sort((a, b) => b - a);
  const isFlush = cards.every((c) => suitOf(c) === suitOf(cards[0]));

  // ストレート判定。wheel (A2345) は 5-high として扱う
  let straightHigh: number | null = null;
  if (new Set(values).size === 5) {
    if (values[0] - values[4] === 4) {
      straightHigh = values[0];
    } else if (values[0] === 14 && values[1] === 5 && values[4] === 2) {
      straightHigh = 5;
    }
  }

  // ランクごとの枚数 → [枚数降順, 同数ならランク降順]
  const countByValue = new Map<number, number>();
  for (const v of values) countByValue.set(v, (countByValue.get(v) ?? 0) + 1);
  const groups = [...countByValue.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const groupValues = groups.map(([v]) => v);

  const make = (handRank: HandRank, rest: number[]): { handRank: HandRank; score: number[] } => ({
    handRank,
    score: [HAND_RANK_STRENGTH[handRank], ...rest],
  });

  if (isFlush && straightHigh !== null) return make('straightFlush', [straightHigh]);
  if (groups[0][1] === 4) return make('fourOfAKind', groupValues);
  if (groups[0][1] === 3 && groups[1][1] === 2) return make('fullHouse', groupValues);
  if (isFlush) return make('flush', values);
  if (straightHigh !== null) return make('straight', [straightHigh]);
  if (groups[0][1] === 3) return make('threeOfAKind', groupValues);
  if (groups[0][1] === 2 && groups[1][1] === 2) return make('twoPair', groupValues);
  if (groups[0][1] === 2) return make('onePair', groupValues);
  return make('highCard', values);
}

/** n枚から5枚のすべての組み合わせを列挙する */
function combinationsOfFive(cards: Card[]): Card[][] {
  const result: Card[][] = [];
  const pick: Card[] = [];
  const walk = (start: number): void => {
    if (pick.length === 5) {
      result.push([...pick]);
      return;
    }
    for (let i = start; i <= cards.length - (5 - pick.length); i++) {
      pick.push(cards[i]);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  return result;
}

/**
 * ホールカード＋コミュニティカードから最良5枚の役を判定する。
 * score は [役の強さ, 主ランク..., キッカー...] の数値タプル（SPEC 3.10）。
 * wheel straight (A2345) は 5-high として扱う。
 */
export function evaluateHand(
  playerId: string,
  holeCards: Card[],
  communityCards: Card[],
): HandResult {
  const all = [...holeCards, ...communityCards];
  if (all.length < 5) {
    throw new Error(`evaluateHand requires at least 5 cards, got ${all.length}`);
  }

  let best: { handRank: HandRank; score: number[] } | null = null;
  let bestCards: Card[] = [];
  for (const combo of combinationsOfFive(all)) {
    const evaluated = evaluateFive(combo);
    if (best === null || compareScores(evaluated.score, best.score) > 0) {
      best = evaluated;
      bestCards = combo;
    }
  }

  return {
    playerId,
    handRank: best!.handRank,
    bestFiveCards: bestCards,
    score: best!.score,
  };
}

/** score を辞書順比較する。a が強ければ正、b が強ければ負、同点は 0 */
export function compareScores(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av < bv ? -1 : 1;
  }
  return 0;
}
