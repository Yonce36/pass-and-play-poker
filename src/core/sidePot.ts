// sidePot — サイドポット生成（pure function）。SPEC 4.4 を正とする
import type { Player, Pot } from '@/types';

/**
 * 全プレイヤーの totalContribution からポット群を一括生成する。
 * folded のチップはポットに入るが eligible には入らない。
 */
export function buildPots(players: Player[]): Pot[] {
  void players;
  throw new Error('not implemented');
}
