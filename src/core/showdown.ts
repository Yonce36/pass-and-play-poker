// showdown — ポット分配（pure function）。SPEC 4.5 を正とする
import { compareScores } from '@/core/handEval';
import type { HandResult, Player, Pot } from '@/types';

/** playerId → 獲得チップ額 */
export type Payouts = Record<string, number>;

/** ボタンの左隣から時計回りの playerId 順（odd chip の優先順位。SPEC 4.5） */
function clockwiseFromButton(players: Player[], dealerButtonPlayerId: string): string[] {
  const seated = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const buttonPos = seated.findIndex((p) => p.id === dealerButtonPlayerId);
  if (buttonPos === -1) {
    throw new Error(`distributePots: button player not found: ${dealerButtonPlayerId}`);
  }
  return seated.map((_, i) => seated[(buttonPos + 1 + i) % seated.length].id);
}

/**
 * ポットごとに eligible の HandResult を比較して分配額を算出する。
 * 同点はチョップ。割り切れない端数はボタンから時計回りで最初の eligible へ。
 */
export function distributePots(
  pots: Pot[],
  results: HandResult[],
  players: Player[],
  dealerButtonPlayerId: string,
): Payouts {
  const resultById = new Map(results.map((r) => [r.playerId, r]));
  const clockwise = clockwiseFromButton(players, dealerButtonPlayerId);

  const payouts: Payouts = {};
  for (const pot of pots) {
    const contenders = pot.eligiblePlayerIds.map((id) => {
      const result = resultById.get(id);
      if (!result) throw new Error(`distributePots: missing HandResult for ${id}`);
      return result;
    });
    if (contenders.length === 0) {
      throw new Error('distributePots: pot has no eligible players');
    }

    let bestScore = contenders[0].score;
    for (const c of contenders) {
      if (compareScores(c.score, bestScore) > 0) bestScore = c.score;
    }
    const winners = contenders
      .filter((c) => compareScores(c.score, bestScore) === 0)
      .map((c) => c.playerId);

    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount - share * winners.length;
    for (const id of winners) {
      payouts[id] = (payouts[id] ?? 0) + share;
    }
    if (remainder > 0) {
      const winnerSet = new Set(winners);
      const first = clockwise.find((id) => winnerSet.has(id))!;
      payouts[first] += remainder;
    }
  }
  return payouts;
}
