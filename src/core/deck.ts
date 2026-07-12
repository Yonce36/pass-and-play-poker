// deck — 山札の生成とシャッフル（pure function。乱数は引数注入）
import type { Card } from '@/types';

/** 52枚の山札を生成する（重複なし） */
export function createDeck(): Card[] {
  throw new Error('not implemented');
}

/** 注入された乱数関数（0以上1未満）で山札をシャッフルする。元配列は変更しない */
export function shuffleDeck(deck: Card[], random: () => number): Card[] {
  void deck;
  void random;
  throw new Error('not implemented');
}
