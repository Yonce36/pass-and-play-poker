// deck のテスト — docs/SPEC.md セクション7「deck: 52枚 / 重複なし / 注入乱数で再現可能」
import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../src/types';
import { createDeck, shuffleDeck } from '../src/deck';

const SUITS: Suit[] = ['H', 'D', 'C', 'S'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

/** 4スート×13ランクの全52枚(スート→ランク順の固定並び) */
function fullDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank): Card => `${suit}${rank}`));
}

/** 固定シードのLCG(決定的な注入乱数。0以上1未満を返す) */
function makeLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe('createDeck', () => {
  it('52枚の山札を返す', () => {
    expect(createDeck()).toHaveLength(52);
  });

  it('重複がない', () => {
    const deck = createDeck();
    expect(new Set(deck).size).toBe(deck.length);
  });

  it('4スート×13ランクの全組み合わせが揃っている', () => {
    const deck = new Set(createDeck());
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        expect(deck.has(`${suit}${rank}`)).toBe(true);
      }
    }
  });
});

describe('shuffleDeck', () => {
  it('同じ乱数列なら同じ並びになる(再現可能)', () => {
    const deck = fullDeck();
    const a = shuffleDeck(deck, makeLcg(42));
    const b = shuffleDeck(deck, makeLcg(42));
    expect(a).toEqual(b);
  });

  it('52枚と内容が保たれる(並びだけ変わる)', () => {
    const deck = fullDeck();
    const shuffled = shuffleDeck(deck, makeLcg(42));
    expect(shuffled).toHaveLength(52);
    expect([...shuffled].sort()).toEqual([...deck].sort());
  });

  it('元配列を変更しない(非破壊)', () => {
    const deck = fullDeck();
    const snapshot = [...deck];
    const shuffled = shuffleDeck(deck, makeLcg(42));
    expect(deck).toEqual(snapshot);
    expect(shuffled).not.toBe(deck);
  });

  it('異なる乱数列なら異なる並びになる(52!通りに対しほぼ確実)', () => {
    const deck = fullDeck();
    const a = shuffleDeck(deck, makeLcg(1));
    const b = shuffleDeck(deck, makeLcg(2));
    expect(a).not.toEqual(b);
  });
});
