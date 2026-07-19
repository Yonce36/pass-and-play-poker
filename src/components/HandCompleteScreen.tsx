'use client';

import { useEffect, useState } from 'react';
import { selectHandCompleteView, useGameStore } from '@/store/gameStore';
import { CardSlot, CardView, ChipAmount } from './CardView';
import { GameOverScreen } from './GameOverScreen';

const RANK_LABEL: Record<string, string> = {
  highCard: 'ハイカード',
  onePair: 'ワンペア',
  twoPair: 'ツーペア',
  threeOfAKind: 'スリーカード',
  straight: 'ストレート',
  flush: 'フラッシュ',
  fullHouse: 'フルハウス',
  fourOfAKind: 'フォーカード',
  straightFlush: 'ストレートフラッシュ',
};

/**
 * ハンド終了画面。showdown 確定後は文字説明なしで、
 * ベスト5=金枠・未使用=減光、役名バッジのみ(ポーカープレイヤー向け)。
 */
export function HandCompleteScreen() {
  const state = useGameStore();
  const startNextHand = useGameStore((s) => s.startNextHand);
  const isGameOver = state.phase === 'gameOver';
  const [finalHandSeen, setFinalHandSeen] = useState(false);
  const view = selectHandCompleteView(state);

  const runOutFrom = view.isShowdown ? state.runOutFrom : null;
  const [revealedCount, setRevealedCount] = useState(runOutFrom ?? 5);
  useEffect(() => {
    if (revealedCount >= 5) return;
    const timer = setTimeout(() => setRevealedCount((n) => (n < 3 ? 3 : n + 1)), 1100);
    return () => clearTimeout(timer);
  }, [revealedCount]);
  const done = revealedCount >= 5;

  const handWinners = view.entries.filter((e) => e.isHandWinner);
  const winnerLabel = handWinners.map((w) => w.name).join(' / ');
  const isChop = view.isChop;
  const bannerAmount = isChop
    ? handWinners.reduce((s, w) => s + w.amount, 0)
    : (handWinners[0]?.amount ??
      view.entries.filter((e) => e.amount > 0).reduce((s, w) => s + w.amount, 0));

  if (isGameOver && finalHandSeen) {
    return <GameOverScreen />;
  }

  return (
    <div className="animate-screen-fade flex flex-1 flex-col items-center gap-5 overflow-y-auto p-5">
      {done ? (
        <div className="animate-winner-pop mt-4 flex flex-col items-center gap-1 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">
            {isChop ? 'チョップ' : 'WINNER'}
          </p>
          <h1 className="text-3xl font-black">{winnerLabel}</h1>
          <div className="animate-chip-float">
            <ChipAmount amount={bannerAmount} className="text-xl text-gold" />
          </div>
        </div>
      ) : (
        <div className="animate-winner-pop mt-4 flex flex-col items-center gap-1 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-rose-400">ALL IN</p>
          <h1 className="text-3xl font-black">ショーダウン</h1>
          <ChipAmount amount={view.potTotal} className="text-xl text-zinc-300" />
        </div>
      )}

      {view.isShowdown && (
        <div className="flex flex-col items-center gap-2 rounded-4xl border-4 border-rail bg-[radial-gradient(ellipse_at_center,var(--color-felt-light)_0%,var(--color-felt)_78%)] px-5 py-4">
          <div className="flex gap-1.5">
            {state.communityCards.slice(0, revealedCount).map((c, i) => (
              <CardView key={c} card={c} size="sm" animate={runOutFrom !== null && i >= runOutFrom} />
            ))}
            {Array.from({ length: 5 - revealedCount }).map((_, i) => (
              <CardSlot key={`slot-${i}`} size="sm" />
            ))}
          </div>
        </div>
      )}

      <div className="flex w-full max-w-sm flex-col gap-3">
        {view.entries.map((entry) => {
          const won = done && entry.isHandWinner;
          const best = new Set(entry.bestFiveCards ?? []);
          return (
            <div
              key={entry.playerId}
              className={`overflow-hidden rounded-2xl border p-4 ${
                won ? 'border-gold/60 bg-amber-950/20' : 'border-white/10 bg-zinc-900/85'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold">{entry.name}</p>
                {done && entry.amount > 0 && (
                  <ChipAmount
                    amount={entry.amount}
                    className={won ? 'text-gold' : 'text-zinc-300'}
                  />
                )}
              </div>
              {entry.cards && entry.handRank ? (
                <div className="mt-3 flex flex-col gap-2.5">
                  <div className="flex gap-2">
                    {entry.cards.map((c) => (
                      <CardView
                        key={c}
                        card={c}
                        size="sm"
                        animate={runOutFrom !== null}
                        highlighted={done && best.has(c)}
                        dimmed={done && !best.has(c)}
                      />
                    ))}
                  </div>
                  {done && (
                    <div className="flex flex-wrap gap-1.5">
                      {state.communityCards.map((c) => (
                        <CardView
                          key={`board-${entry.playerId}-${c}`}
                          card={c}
                          size="sm"
                          highlighted={best.has(c)}
                          dimmed={!best.has(c)}
                        />
                      ))}
                    </div>
                  )}
                  {done && (
                    <span
                      className={`self-start rounded-full px-3 py-1 text-xs font-bold ${
                        won ? 'bg-gold text-zinc-900' : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {RANK_LABEL[entry.handRank]}
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs text-zinc-500">手札は非公開です</p>
              )}
            </div>
          );
        })}
      </div>

      {done && (
        <button
          type="button"
          onClick={() => (isGameOver ? setFinalHandSeen(true) : startNextHand())}
          className="animate-screen-fade mt-auto w-full max-w-sm rounded-full bg-emerald-600 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-950/50 active:scale-[0.98] active:bg-emerald-700"
        >
          {isGameOver ? '最終結果へ' : '次のハンドへ'}
        </button>
      )}
    </div>
  );
}
