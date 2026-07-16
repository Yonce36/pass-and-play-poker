'use client';

import { selectHandCompleteView, useGameStore } from '@/store/gameStore';
import { CardView } from './CardView';

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
 * selectHandCompleteView に集約されている（コンポーネントにゲームロジックを書かない。CLAUDE.md 原則2）。
 * fold勝ちでは cards が null で返るため手札は描画されない（STATE_MACHINE 3）。
 */
export function HandCompleteScreen() {
  const state = useGameStore();
  const startNextHand = useGameStore((s) => s.startNextHand);
  const view = selectHandCompleteView(state);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-2xl font-bold">ハンド終了</h1>
      <p className="text-sm text-zinc-500">ポット {view.potTotal}</p>

      <div className="flex w-full max-w-sm flex-col gap-4">
        {view.entries.map((entry) => (
          <div key={entry.playerId} className="rounded-md border border-zinc-200 p-3">
            <p className="font-semibold">
              {entry.name} {entry.amount > 0 && <span className="text-emerald-600">+{entry.amount}</span>}
            </p>
            {entry.cards && entry.handRank ? (
              <>
                <p className="text-xs text-zinc-500">{RANK_LABEL[entry.handRank]}</p>
                <div className="mt-2 flex justify-center gap-2">
                  {entry.cards.map((c) => (
                    <CardView key={c} card={c} />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-zinc-500">手札は非公開です</p>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => startNextHand()}
        className="rounded-full bg-emerald-600 px-8 py-3 text-lg font-semibold text-white active:bg-emerald-700"
      >
        次のハンドへ
      </button>
    </div>
  );
}
