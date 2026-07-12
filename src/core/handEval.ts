// handEval — 役判定とスコア比較（pure function）
import type { Card, HandResult } from '@/types';

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
  void playerId;
  void holeCards;
  void communityCards;
  throw new Error('not implemented');
}

/** score を辞書順比較する。a が強ければ正、b が強ければ負、同点は 0 */
export function compareScores(a: number[], b: number[]): number {
  void a;
  void b;
  throw new Error('not implemented');
}
