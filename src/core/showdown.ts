// showdown — ポット分配（pure function）。SPEC 4.5 を正とする
import type { HandResult, Player, Pot } from '@/types';

/** playerId → 獲得チップ額 */
export type Payouts = Record<string, number>;

/**
 * ポットごとに eligible の HandResult を比較して分配額を算出する。
 * 同点チョップの端数はボタンから時計回りで最初の eligible へ（odd chip）。
 */
export function distributePots(
  pots: Pot[],
  results: HandResult[],
  players: Player[],
  dealerButtonPlayerId: string,
): Payouts {
  void pots;
  void results;
  void players;
  void dealerButtonPlayerId;
  throw new Error('not implemented');
}
