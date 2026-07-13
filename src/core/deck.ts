// deck — 山札の生成とシャッフル（pure function。乱数は引数注入）
import type { Card, Rank, Suit } from '@/types';

const SUITS: Suit[] = ['H', 'D', 'C', 'S'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

/** 52枚の山札を生成する（重複なし） */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${suit}${rank}`);
    }
  }
  return deck;
}

/** 注入された乱数関数（0以上1未満）で山札をシャッフルする。元配列は変更しない */
export function shuffleDeck(deck: Card[], random: () => number): Card[] {
  const shuffled = [...deck];
  // Fisher-Yates
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
