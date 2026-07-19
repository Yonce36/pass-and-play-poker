'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { ChipAmount } from './CardView';

/**
 * reveal 中のみ表示される手番プレイヤーの操作パネル。
 * 合法性の最終判定は core の applyAction が行う(ここでの活性制御はUXのための事前フィルタに過ぎない)。
 * アクション確定後は必ず concealCards() を呼び、手札を DOM から即座に取り除く(漏洩防止)。
 * cards を含む Player を props で受けず、viewerId から必要なフィールドだけ store で参照する。
 */
export function ActionPanel({ viewerId }: { viewerId: string }) {
  const betting = useGameStore((s) => s.betting);
  const players = useGameStore((s) => s.players);
  const submitAction = useGameStore((s) => s.submitAction);
  const concealCards = useGameStore((s) => s.concealCards);
  const viewer = useGameStore((s) => s.players.find((p) => p.id === viewerId));
  const [amount, setAmount] = useState(betting.minRaiseTo);
  const [error, setError] = useState<string | null>(null);

  if (!viewer) return null;

  const potTotal = players.reduce((sum, p) => sum + p.totalContribution, 0);
  const maxReachable = viewer.currentBet + viewer.chips;
  const facingBet = betting.currentMaxBet > 0;
  const canCheck = viewer.currentBet === betting.currentMaxBet;
  const callAmount = Math.min(betting.currentMaxBet - viewer.currentBet, viewer.chips);
  const canCall = facingBet && viewer.currentBet < betting.currentMaxBet;
  const raiseBlocked = viewer.hasActedThisRound && !viewer.hasOption;
  const canBetOrRaise = maxReachable >= betting.minRaiseTo && (!facingBet || !raiseBlocked);
  const canAllIn = viewer.chips > 0;

  const clamp = (v: number) => Math.min(Math.max(v, betting.minRaiseTo), maxReachable);
  // ポットサイズベット(現在のポット+コール分を足した到達額)の目安
  const potBet = clamp(betting.currentMaxBet + potTotal + (canCall ? callAmount : 0));

  const act = (
    type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allIn',
    actionAmount?: number,
  ) => {
    try {
      submitAction({ playerId: viewer.id, type, amount: actionAmount });
      setError(null);
      concealCards();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/85 px-4 py-2 text-sm">
        <span className="text-zinc-400">
          ポット <ChipAmount amount={potTotal} className="text-zinc-200" />
        </span>
        <span className="text-zinc-400">
          残り <ChipAmount amount={viewer.chips} className="text-zinc-200" />
        </span>
      </div>

      {error && <p className="text-center text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => act('fold')}
          className="rounded-xl bg-zinc-800 py-3.5 font-bold text-zinc-200 ring-1 ring-white/10 active:scale-[0.98] active:bg-zinc-700"
        >
          フォールド
        </button>
        {canCheck ? (
          <button
            type="button"
            onClick={() => act('check')}
            className="rounded-xl bg-sky-700 py-3.5 font-bold text-white active:scale-[0.98] active:bg-sky-800"
          >
            チェック
          </button>
        ) : (
          <button
            type="button"
            disabled={!canCall}
            onClick={() => act('call')}
            className="rounded-xl bg-sky-700 py-3.5 font-bold text-white active:scale-[0.98] active:bg-sky-800 disabled:opacity-40"
          >
            コール {callAmount}
          </button>
        )}
      </div>

      {canBetOrRaise && (
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-zinc-900/85 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">{facingBet ? 'レイズ額(到達額)' : 'ベット額'}</span>
            <input
              type="number"
              inputMode="numeric"
              min={betting.minRaiseTo}
              max={maxReachable}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-24 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-right font-mono text-lg text-white focus:border-gold focus:outline-none"
            />
          </div>
          <input
            type="range"
            min={betting.minRaiseTo}
            max={maxReachable}
            step={1}
            value={clamp(amount)}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full accent-amber-400"
            aria-label="ベット額スライダー"
          />
          <div className="grid grid-cols-3 gap-2 text-sm">
            <button
              type="button"
              onClick={() => setAmount(betting.minRaiseTo)}
              className="rounded-lg bg-zinc-800 py-1.5 text-zinc-300 ring-1 ring-white/10 active:bg-zinc-700"
            >
              最小 {betting.minRaiseTo}
            </button>
            <button
              type="button"
              onClick={() => setAmount(potBet)}
              className="rounded-lg bg-zinc-800 py-1.5 text-zinc-300 ring-1 ring-white/10 active:bg-zinc-700"
            >
              ポット
            </button>
            <button
              type="button"
              onClick={() => setAmount(maxReachable)}
              className="rounded-lg bg-zinc-800 py-1.5 text-zinc-300 ring-1 ring-white/10 active:bg-zinc-700"
            >
              最大
            </button>
          </div>
          <button
            type="button"
            disabled={amount < betting.minRaiseTo || amount > maxReachable}
            onClick={() => act(facingBet ? 'raise' : 'bet', amount)}
            className="rounded-xl bg-emerald-600 py-3.5 font-bold text-white active:scale-[0.98] active:bg-emerald-700 disabled:opacity-40"
          >
            {facingBet ? `レイズ to ${clamp(amount)}` : `ベット ${clamp(amount)}`}
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={!canAllIn}
        onClick={() => act('allIn')}
        className="rounded-xl bg-linear-to-r from-rose-600 to-rose-700 py-3.5 font-bold text-white shadow-lg shadow-rose-950/40 active:scale-[0.98] disabled:opacity-40"
      >
        オールイン {maxReachable}
      </button>
    </div>
  );
}
