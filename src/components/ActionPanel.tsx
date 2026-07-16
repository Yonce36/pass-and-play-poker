'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';

/**
 * reveal 中のみ表示される手番プレイヤーの操作パネル。
 * 合法性の最終判定は core の applyAction が行う（ここでの活性制御はUXのための事前フィルタに過ぎない）。
 * アクション確定後は必ず concealCards() を呼び、手札を DOM から即座に取り除く（漏洩防止）。
 * cards を含む Player を props で受けず、viewerId から必要なフィールドだけ store で参照する。
 */
export function ActionPanel({ viewerId }: { viewerId: string }) {
  const betting = useGameStore((s) => s.betting);
  const submitAction = useGameStore((s) => s.submitAction);
  const concealCards = useGameStore((s) => s.concealCards);
  const viewer = useGameStore((s) => s.players.find((p) => p.id === viewerId));
  const [amount, setAmount] = useState(betting.minRaiseTo);
  const [error, setError] = useState<string | null>(null);

  if (!viewer) return null;

  const maxReachable = viewer.currentBet + viewer.chips;
  const facingBet = betting.currentMaxBet > 0;
  const canCheck = viewer.currentBet === betting.currentMaxBet;
  const callAmount = Math.min(betting.currentMaxBet - viewer.currentBet, viewer.chips);
  const canCall = facingBet && viewer.currentBet < betting.currentMaxBet;
  const raiseBlocked = viewer.hasActedThisRound && !viewer.hasOption;
  const canBetOrRaise = maxReachable >= betting.minRaiseTo && (!facingBet || !raiseBlocked);
  const canAllIn = viewer.chips > 0;

  const act = (type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allIn', actionAmount?: number) => {
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
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => act('fold')}
          className="rounded-md bg-zinc-200 py-3 font-semibold text-zinc-800 active:bg-zinc-300"
        >
          フォールド
        </button>
        {canCheck ? (
          <button
            type="button"
            onClick={() => act('check')}
            className="rounded-md bg-zinc-200 py-3 font-semibold text-zinc-800 active:bg-zinc-300"
          >
            チェック
          </button>
        ) : (
          <button
            type="button"
            disabled={!canCall}
            onClick={() => act('call')}
            className="rounded-md bg-blue-600 py-3 font-semibold text-white disabled:opacity-40"
          >
            コール（{callAmount}）
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={betting.minRaiseTo}
          max={maxReachable}
          step={1}
          value={amount}
          disabled={!canBetOrRaise}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 disabled:opacity-40"
        />
        <button
          type="button"
          disabled={!canBetOrRaise || amount < betting.minRaiseTo || amount > maxReachable}
          onClick={() => act(facingBet ? 'raise' : 'bet', amount)}
          className="whitespace-nowrap rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          {facingBet ? 'レイズ' : 'ベット'}
        </button>
      </div>

      <button
        type="button"
        disabled={!canAllIn}
        onClick={() => act('allIn')}
        className="rounded-md bg-rose-600 py-3 font-semibold text-white disabled:opacity-40"
      >
        オールイン（{maxReachable}）
      </button>
    </div>
  );
}
