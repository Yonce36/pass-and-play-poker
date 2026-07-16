'use client';

import { selectHandCompleteView, useGameStore } from '@/store/gameStore';
import { CardView, ChipAmount } from './CardView';

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
 * ハンド終了画面。showdown/fold勝ちの判定と分配額の導出は store の
 * selectHandCompleteView に集約されている(コンポーネントにゲームロジックを書かない。CLAUDE.md 原則2)。
 * fold勝ちでは cards が null で返るため手札は描画されない(STATE_MACHINE 3)。
 * showdown では役に使われた5枚(bestFiveCards)以外を減光して「何で勝ったか」を見せる。
 */
export function HandCompleteScreen() {
  const state = useGameStore();
  const startNextHand = useGameStore((s) => s.startNextHand);
  const view = selectHandCompleteView(state);

  const winners = view.entries.filter((e) => e.amount > 0);
  const winnerLabel = winners.map((w) => w.name).join(' / ');
  const isChop = winners.length > 1;

  return (
    <div className="animate-screen-fade flex flex-1 flex-col items-center gap-5 overflow-y-auto p-5">
      {/* 勝者バナー */}
      <div className="animate-winner-pop mt-4 flex flex-col items-center gap-1 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">
          {isChop ? 'チョップ' : 'WINNER'}
        </p>
        <h1 className="text-3xl font-black">{winnerLabel}</h1>
        <div className="animate-chip-float">
          <ChipAmount
            amount={winners.reduce((s, w) => s + w.amount, 0)}
            className="text-xl text-gold"
          />
        </div>
      </div>

      {/* コミュニティカード(showdown時のみ意味がある) */}
      {view.isShowdown && state.communityCards.length > 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[2rem] border-4 border-rail bg-[radial-gradient(ellipse_at_center,var(--color-felt-light)_0%,var(--color-felt)_78%)] px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/60">ボード</p>
          <div className="flex gap-1.5">
            {state.communityCards.map((c) => (
              <CardView key={c} card={c} size="sm" />
            ))}
          </div>
        </div>
      )}

      <div className="flex w-full max-w-sm flex-col gap-3">
        {view.entries.map((entry) => {
          const won = entry.amount > 0;
          const best = new Set(entry.bestFiveCards ?? []);
          return (
            <div
              key={entry.playerId}
              className={`rounded-2xl border p-4 ${
                won ? 'border-gold/60 bg-amber-950/20' : 'border-white/10 bg-zinc-900/85'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold">{entry.name}</p>
                {won && <ChipAmount amount={entry.amount} className="text-gold" />}
              </div>
              {entry.cards && entry.handRank ? (
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex gap-2">
                    {entry.cards.map((c) => (
                      <CardView key={c} card={c} size="sm" dimmed={!best.has(c)} />
                    ))}
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      won ? 'bg-gold text-zinc-900' : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {RANK_LABEL[entry.handRank]}
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-xs text-zinc-500">手札は非公開です</p>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => startNextHand()}
        className="mt-auto w-full max-w-sm rounded-full bg-emerald-600 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-950/50 active:scale-[0.98] active:bg-emerald-700"
      >
        次のハンドへ
      </button>
    </div>
  );
}
