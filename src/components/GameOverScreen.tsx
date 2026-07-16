'use client';

import { useGameStore } from '@/store/gameStore';

export function GameOverScreen() {
  const players = useGameStore((s) => s.players);
  const resetToSetup = useGameStore((s) => s.resetToSetup);

  const winner = players.find((p) => p.status !== 'busted' && p.status !== 'sittingOut');

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">ゲーム終了</h1>
      {winner && <p className="text-xl">{winner.name} さんの勝利です！</p>}
      <button
        type="button"
        onClick={resetToSetup}
        className="rounded-full bg-emerald-600 px-8 py-3 text-lg font-semibold text-white active:bg-emerald-700"
      >
        新しいゲームを始める
      </button>
    </div>
  );
}
