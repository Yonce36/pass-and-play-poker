// handEval — 役判定とスコア比較（pure function）
import type { Card, HandRank, HandResult } from './types';

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

const RANK_DISPLAY: Record<number, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

function formatRankValue(v: number): string {
  return RANK_DISPLAY[v] ?? String(v);
}

function formatRankList(values: number[]): string {
  return values.map(formatRankValue).join('-');
}

/**
 * 役+スコアから表示用ラベルを作る（UI専用の説明。比較には score 本体を使う）。
 * score[0] は役強度、以降は handEval の rest（主ランク・キッカー）。
 */
export function describeHand(
  handRank: HandRank,
  score: number[],
): { title: string; kickerLine: string | null } {
  const r = score.slice(1);
  switch (handRank) {
    case 'highCard':
      return {
        title: `ハイカード ${formatRankValue(r[0] ?? 0)}`,
        kickerLine: r.length > 1 ? `キッカー ${formatRankList(r.slice(1))}` : null,
      };
    case 'onePair':
      return {
        title: `ワンペア (${formatRankValue(r[0] ?? 0)})`,
        kickerLine: r.length > 1 ? `キッカー ${formatRankList(r.slice(1))}` : null,
      };
    case 'twoPair':
      return {
        title: `ツーペア (${formatRankValue(r[0] ?? 0)} と ${formatRankValue(r[1] ?? 0)})`,
        kickerLine: r[2] !== undefined ? `キッカー ${formatRankValue(r[2])}` : null,
      };
    case 'threeOfAKind':
      return {
        title: `スリーカード (${formatRankValue(r[0] ?? 0)})`,
        kickerLine: r.length > 1 ? `キッカー ${formatRankList(r.slice(1))}` : null,
      };
    case 'straight':
      return {
        title: `ストレート (${formatRankValue(r[0] ?? 0)} ハイ)`,
        kickerLine: null,
      };
    case 'flush':
      return {
        title: 'フラッシュ',
        kickerLine: r.length > 0 ? `構成 ${formatRankList(r)}` : null,
      };
    case 'fullHouse':
      return {
        title: `フルハウス (${formatRankValue(r[0] ?? 0)} フルオブ ${formatRankValue(r[1] ?? 0)})`,
        kickerLine: null,
      };
    case 'fourOfAKind':
      return {
        title: `フォーカード (${formatRankValue(r[0] ?? 0)})`,
        kickerLine: r[1] !== undefined ? `キッカー ${formatRankValue(r[1])}` : null,
      };
    case 'straightFlush':
      return {
        title: `ストレートフラッシュ (${formatRankValue(r[0] ?? 0)} ハイ)`,
        kickerLine: null,
      };
    default: {
      const _exhaustive: never = handRank;
      return { title: String(_exhaustive), kickerLine: null };
    }
  }
}
