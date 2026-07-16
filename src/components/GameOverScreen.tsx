'use client';

import { useGameStore } from '@/store/gameStore';
import { ChipAmount } from './CardView';

export function GameOverScreen() {
  const players = useGameStore((s) => s.players);
  const resetToSetup = useGameStore((s) => s.resetToSetup);

  const winner = players.find((p) => p.status !== 'busted' && p.status !== 'sittingOut');

  return (
    <div className="animate-screen-fade flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="animate-winner-pop flex flex-col items-center gap-3">
        <span className="text-6xl">🏆</span>
        <p className="text-xs uppercase tracking-[0.3em] text-gold">CHAMPION</p>
        {winner && (
          <>
            <h1 className="text-4xl font-black">{winner.name}</h1>
            <div className="animate-chip-float">
              <ChipAmount amount={winner.chips} className="text-xl text-gold" />
            </div>
          </>
        )}
      </div>

      <div className="flex w-full max-w-sm flex-col gap-2">
        {players.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${
              p.id === winner?.id
                ? 'border-gold/60 bg-amber-950/20'
                : 'border-white/10 bg-zinc-900/85 opacity-60'
            }`}
          >
            <span className="font-semibold">{p.name}</span>
            <ChipAmount amount={p.chips} className="text-sm" />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={resetToSetup}
        className="w-full max-w-sm rounded-full bg-emerald-600 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-950/50 active:scale-[0.98] active:bg-emerald-700"
      >
        新しいゲームを始める
      </button>
    </div>
  );
}
