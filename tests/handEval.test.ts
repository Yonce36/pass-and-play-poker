// Phase 4: handEval のテスト（SPEC 3.10 / セクション7 準拠、テスト先行）
// カード表記はスート先行: 'HA' = ハートのA（SPEC 3.1）
import { describe, expect, it } from 'vitest';
import { compareScores, evaluateHand } from '@/core/handEval';
import type { Card } from '@/types';

const eva = (hole: Card[], community: Card[]) => evaluateHand('p1', hole, community);

describe('evaluateHand: 全9役の判定', () => {
  it('highCard', () => {
    const r = eva(['H2', 'D5'], ['C7', 'S9', 'HJ', 'DQ', 'SA']);
    expect(r.handRank).toBe('highCard');
  });

  it('onePair', () => {
    const r = eva(['HA', 'D3'], ['CA', 'S6', 'H8', 'DT', 'CQ']);
    expect(r.handRank).toBe('onePair');
  });

  it('twoPair', () => {
    const r = eva(['HA', 'DK'], ['CA', 'SK', 'H4', 'D9', 'C7']);
    expect(r.handRank).toBe('twoPair');
  });

  it('threeOfAKind', () => {
    const r = eva(['HQ', 'DQ'], ['CQ', 'S3', 'H6', 'D9', 'CJ']);
    expect(r.handRank).toBe('threeOfAKind');
  });

  it('straight', () => {
    const r = eva(['H5', 'D6'], ['C7', 'S8', 'H9', 'D2', 'CK']);
    expect(r.handRank).toBe('straight');
  });

  it('flush', () => {
    const r = eva(['H2', 'H8'], ['H5', 'HJ', 'HQ', 'D3', 'C9']);
    expect(r.handRank).toBe('flush');
  });

  it('fullHouse', () => {
    const r = eva(['HK', 'DK'], ['CK', 'S2', 'H2', 'D8', 'C5']);
    expect(r.handRank).toBe('fullHouse');
  });

  it('fourOfAKind', () => {
    const r = eva(['H7', 'D7'], ['C7', 'S7', 'HA', 'D4', 'C9']);
    expect(r.handRank).toBe('fourOfAKind');
  });

  it('straightFlush（フラッシュ・ストレートより優先して選ぶ）', () => {
    const r = eva(['S9', 'ST'], ['SJ', 'SQ', 'SK', 'H2', 'D3']);
    expect(r.handRank).toBe('straightFlush');
  });
});

describe('evaluateHand: 役の強さの順序（score 辞書順比較）', () => {
  it('9役が正しい順序で強くなる', () => {
    const hands = [
      eva(['H2', 'D5'], ['C7', 'S9', 'HJ', 'DQ', 'SA']), // highCard
      eva(['HA', 'D3'], ['CA', 'S6', 'H8', 'DT', 'CQ']), // onePair
      eva(['HA', 'DK'], ['CA', 'SK', 'H4', 'D9', 'C7']), // twoPair
      eva(['HQ', 'DQ'], ['CQ', 'S3', 'H6', 'D9', 'CJ']), // threeOfAKind
      eva(['H5', 'D6'], ['C7', 'S8', 'H9', 'D2', 'CK']), // straight
      eva(['H2', 'H8'], ['H5', 'HJ', 'HQ', 'D3', 'C9']), // flush
      eva(['HK', 'DK'], ['CK', 'S2', 'H2', 'D8', 'C5']), // fullHouse
      eva(['H7', 'D7'], ['C7', 'S7', 'HA', 'D4', 'C9']), // fourOfAKind
      eva(['S9', 'ST'], ['SJ', 'SQ', 'SK', 'H2', 'D3']), // straightFlush
    ];
    for (let i = 1; i < hands.length; i++) {
      expect(compareScores(hands[i].score, hands[i - 1].score)).toBeGreaterThan(0);
    }
  });
});

describe('evaluateHand: wheel straight (A2345)', () => {
  it('A2345 は straight として判定される', () => {
    const r = eva(['HA', 'D2'], ['C3', 'S4', 'H5', 'DK', 'CQ']);
    expect(r.handRank).toBe('straight');
  });

  it('wheel は 5-high として 6-high straight に負ける', () => {
    const wheel = eva(['HA', 'D2'], ['C3', 'S4', 'H5', 'DK', 'CQ']);
    const sixHigh = eva(['H2', 'D3'], ['C4', 'S5', 'H6', 'DK', 'CQ']);
    expect(compareScores(sixHigh.score, wheel.score)).toBeGreaterThan(0);
  });

  it('steel wheel (A2345 同スート) は 5-high の straightFlush', () => {
    const steel = eva(['SA', 'S2'], ['S3', 'S4', 'S5', 'HK', 'DQ']);
    const sixHighSF = eva(['H2', 'H3'], ['H4', 'H5', 'H6', 'SK', 'DQ']);
    expect(steel.handRank).toBe('straightFlush');
    expect(compareScores(sixHighSF.score, steel.score)).toBeGreaterThan(0);
  });
});

describe('evaluateHand: キッカー比較', () => {
  const board: Card[] = ['DA', 'S8', 'H6', 'C4', 'D2'];

  it('同じペアならキッカーが強い方が勝つ', () => {
    const kicker13 = eva(['HA', 'CK'], board); // A pair + K kicker
    const kicker12 = eva(['SA', 'CQ'], board); // A pair + Q kicker
    expect(compareScores(kicker13.score, kicker12.score)).toBeGreaterThan(0);
  });

  it('highCard 同士は上位カードから順に比較される', () => {
    const aceHigh = eva(['HA', 'C3'], ['S8', 'H6', 'C4', 'DT', 'DQ']);
    const kingHigh = eva(['HK', 'C3'], ['S8', 'H6', 'C4', 'DT', 'DQ']);
    expect(compareScores(aceHigh.score, kingHigh.score)).toBeGreaterThan(0);
  });

  it('flush 同士は構成カードで比較される', () => {
    const community: Card[] = ['H5', 'H8', 'HJ', 'D3', 'C4'];
    const kingFlush = eva(['H2', 'HK'], community);
    const queenFlush = eva(['HQ', 'H9'], community);
    expect(compareScores(kingFlush.score, queenFlush.score)).toBeGreaterThan(0);
  });
});

describe('evaluateHand: チョップ（引き分け）', () => {
  it('ボードのみが最強ならスコアが完全一致する', () => {
    const community: Card[] = ['H6', 'D7', 'C8', 'S9', 'HT']; // ボードにT-highストレート
    const p1 = eva(['H2', 'D3'], community);
    const p2 = eva(['C2', 'D4'], community);
    expect(p1.handRank).toBe('straight');
    expect(compareScores(p1.score, p2.score)).toBe(0);
    expect(p1.score).toEqual(p2.score);
  });
});

describe('evaluateHand: 7枚からの最良5枚選択', () => {
  it('bestFiveCards は入力7枚のうちの5枚', () => {
    const hole: Card[] = ['HA', 'D3'];
    const community: Card[] = ['CA', 'S6', 'H8', 'DT', 'CQ'];
    const r = eva(hole, community);
    expect(r.bestFiveCards).toHaveLength(5);
    const all = new Set([...hole, ...community]);
    for (const c of r.bestFiveCards) expect(all.has(c)).toBe(true);
    expect(new Set(r.bestFiveCards).size).toBe(5);
  });

  it('3ペアあるときは上位2ペア＋最強キッカーを選ぶ', () => {
    // A,A,K,K,Q,Q,2 → AAKK + Q キッカー
    const withQKicker = eva(['HA', 'DK'], ['CA', 'SK', 'HQ', 'DQ', 'C2']);
    const withJKicker = eva(['SA', 'CK'], ['DA', 'HK', 'S5', 'D3', 'CJ']);
    expect(withQKicker.handRank).toBe('twoPair');
    expect(compareScores(withQKicker.score, withJKicker.score)).toBeGreaterThan(0);
  });

  it('トリップスが2組あるときは上位トリップスのフルハウスを選ぶ', () => {
    // 999 + 555 → 999-55 のフルハウス
    const r = eva(['H9', 'D9'], ['C9', 'S5', 'H5', 'D5', 'C2']);
    const weaker = eva(['H5', 'D5'], ['C5', 'S8', 'H8', 'D2', 'C3']); // 555-88
    expect(r.handRank).toBe('fullHouse');
    expect(compareScores(r.score, weaker.score)).toBeGreaterThan(0);
  });

  it('playerId が結果に引き継がれる', () => {
    const r = evaluateHand('alice', ['HA', 'D3'], ['CA', 'S6', 'H8', 'DT', 'CQ']);
    expect(r.playerId).toBe('alice');
  });
});

describe('compareScores: 辞書順比較', () => {
  it('先頭要素が異なれば後続に関係なく決まる', () => {
    expect(compareScores([2, 3], [1, 14])).toBeGreaterThan(0);
    expect(compareScores([1, 14], [2, 3])).toBeLessThan(0);
  });

  it('先頭が同じなら後続要素で決まる', () => {
    expect(compareScores([1, 14, 13], [1, 14, 12])).toBeGreaterThan(0);
  });

  it('完全一致は 0', () => {
    expect(compareScores([4, 5], [4, 5])).toBe(0);
  });
});
