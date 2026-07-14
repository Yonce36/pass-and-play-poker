// sidePot — サイドポット生成（pure function）。SPEC 4.4 を正とする
import type { Player, Pot } from '@/types';

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * 全プレイヤー（foldedを含む）の totalContribution からポット群を一括生成する。
 * 拠出額のユニーク値を昇順にレベルとして層を切り出し、
 * folded のチップはポットに入るが eligible には入らない。
 * eligible が同一の連続層は1つのポットに統合する（同額 all-in で余分な層を作らない）。
 */
export function buildPots(players: Player[]): Pot[] {
  const contributors = players.filter((p) => p.totalContribution > 0);
  const levels = [...new Set(contributors.map((p) => p.totalContribution))].sort(
    (a, b) => a - b,
  );

  const pots: Pot[] = [];
  let prevLevel = 0;
  for (const level of levels) {
    const inLayer = contributors.filter((p) => p.totalContribution >= level);
    const amount = inLayer.length * (level - prevLevel);
    const eligiblePlayerIds = inLayer
      .filter((p) => p.status === 'active' || p.status === 'allIn')
      .map((p) => p.id)
      .sort();

    const last = pots[pots.length - 1];
    if (eligiblePlayerIds.length === 0) {
      // 層の全員が folded（通常の進行では到達しない防御）。残額は直前のポットへ。
      // 帰属先がない場合はチップ保存則を黙って破らず異常として検知する
      if (!last) throw new Error('buildPots: layer has no eligible players and no prior pot');
      last.amount += amount;
    } else if (last && sameIds(last.eligiblePlayerIds, eligiblePlayerIds)) {
      last.amount += amount;
      last.sourceContributionLevel = level;
    } else {
      pots.push({ amount, eligiblePlayerIds, sourceContributionLevel: level });
    }
    prevLevel = level;
  }
  return pots;
}
