'use client';

import { useGameStore } from '@/store/gameStore';
import { CardView } from './CardView';
import { HandoffFlow } from './HandoffFlow';

const STATUS_LABEL: Record<string, string> = {
  active: 'プレイ中',
  folded: 'フォールド',
  allIn: 'オールイン',
  busted: 'バースト',
  sittingOut: '休憩中',
};

const STREET_LABEL: Record<string, string> = {
  postingBlinds: 'ブラインド',
  preflop: 'プリフロップ',
  flop: 'フロップ',
  turn: 'ターン',
  river: 'リバー',
};

export function TableScreen() {
  const players = useGameStore((s) => s.players);
  const communityCards = useGameStore((s) => s.communityCards);
  const activePlayerId = useGameStore((s) => s.activePlayerId);
  const phase = useGameStore((s) => s.phase);
  const handNumber = useGameStore((s) => s.handNumber);

  const potTotal = players.reduce((sum, p) => sum + p.totalContribution, 0);
  const activePlayer = players.find((p) => p.id === activePlayerId);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col items-center gap-2 border-b border-zinc-200 p-4">
        <p className="text-xs text-zinc-500">
          第{handNumber}ハンド ・ {STREET_LABEL[phase] ?? phase}
        </p>
        <p className="text-lg font-bold">ポット: {potTotal}</p>
        <div className="flex gap-2">
          {communityCards.map((c) => (
            <CardView key={c} card={c} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 p-4">
        {players.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between rounded-md border px-3 py-2 ${
              p.id === activePlayerId ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-200'
            }`}
          >
            <div>
              <p className="font-semibold">
                {p.name}
                {p.id === activePlayerId && <span className="ml-2 text-xs text-emerald-600">手番</span>}
              </p>
              <p className="text-xs text-zinc-500">{STATUS_LABEL[p.status] ?? p.status}</p>
            </div>
            <div className="text-right">
              <p className="font-mono">{p.chips} チップ</p>
              {p.currentBet > 0 && <p className="text-xs text-zinc-500">ベット {p.currentBet}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* cards を含む Player を props に流さない（STATE_MACHINE 4 不変条件） */}
      {activePlayer && (
        <HandoffFlow activePlayer={{ id: activePlayer.id, name: activePlayer.name }} />
      )}
    </div>
  );
}
