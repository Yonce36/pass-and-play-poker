'use client';

import { useGameStore } from '@/store/gameStore';
import type { Player } from '@/types';
import { CardBack, CardSlot, CardView, ChipAmount } from './CardView';
import { HandoffFlow } from './HandoffFlow';

const STREET_LABEL: Record<string, string> = {
  postingBlinds: 'ブラインド',
  preflop: 'プリフロップ',
  flop: 'フロップ',
  turn: 'ターン',
  river: 'リバー',
  showdown: 'ショーダウン',
};

/** Seat に渡す表示用情報。cards を props に流さない(STATE_MACHINE 4 不変条件) */
type SeatPlayer = Pick<Player, 'id' | 'name' | 'chips' | 'currentBet' | 'status'> & {
  hasCards: boolean;
};

const toSeatPlayer = (p: Player): SeatPlayer => ({
  id: p.id,
  name: p.name,
  chips: p.chips,
  currentBet: p.currentBet,
  status: p.status,
  hasCards: p.cards.length > 0,
});

/** 1プレイヤー分の席(アバター・チップ・カード裏・ベット・ステータス) */
function Seat({
  player,
  isActive,
  isButton,
}: {
  player: SeatPlayer;
  isActive: boolean;
  isButton: boolean;
}) {
  const inHand = player.status === 'active' || player.status === 'allIn';
  const folded = player.status === 'folded';

  return (
    <div
      className={`relative flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/85 px-4 py-3 ${
        isActive ? 'animate-turn-glow' : ''
      } ${folded ? 'opacity-50' : ''}`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 text-lg font-bold ring-2 ring-white/20">
        {player.name.charAt(0)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-semibold">{player.name}</p>
          {isButton && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-black text-zinc-900 shadow">
              D
            </span>
          )}
        </div>
        <ChipAmount amount={player.chips} className="text-sm text-zinc-300" />
      </div>

      <div className="flex flex-col items-end gap-1.5">
        {player.status === 'allIn' && (
          <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold tracking-wide">
            ALL-IN
          </span>
        )}
        {folded && (
          <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-bold tracking-wide">
            フォールド
          </span>
        )}
        {player.currentBet > 0 && (
          <ChipAmount amount={player.currentBet} className="text-xs text-amber-300" />
        )}
        {inHand && player.hasCards && (
          <div className="flex -space-x-4">
            <CardBack size="sm" />
            <CardBack size="sm" />
          </div>
        )}
      </div>

      {isActive && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-zinc-900 shadow">
          手番
        </span>
      )}
    </div>
  );
}

export function TableScreen() {
  const players = useGameStore((s) => s.players);
  const communityCards = useGameStore((s) => s.communityCards);
  const activePlayerId = useGameStore((s) => s.activePlayerId);
  const dealerButtonPlayerId = useGameStore((s) => s.dealerButtonPlayerId);
  const phase = useGameStore((s) => s.phase);
  const handNumber = useGameStore((s) => s.handNumber);

  const bySeat = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const [heroSeat, ...otherSeats] = bySeat;
  const activePlayer = players.find((p) => p.id === activePlayerId);

  const totalContribution = players.reduce((sum, p) => sum + p.totalContribution, 0);
  const currentBets = players.reduce((sum, p) => sum + p.currentBet, 0);
  // 「ポット」は回収済み分。現ストリートのベットは各席の前に表示する
  const potCollected = totalContribution - currentBets;

  return (
    <div className="flex flex-1 flex-col gap-3 p-3">
      {/* 相手側の席(将来の3人以上にも対応) */}
      <div className="flex flex-col gap-2">
        {otherSeats.map((p) => (
          <Seat
            key={p.id}
            player={toSeatPlayer(p)}
            isActive={p.id === activePlayerId}
            isButton={p.id === dealerButtonPlayerId}
          />
        ))}
      </div>

      {/* テーブル(フェルト) */}
      <div className="relative flex flex-col items-center gap-3 rounded-[2.5rem] border-[6px] border-rail bg-[radial-gradient(ellipse_at_center,var(--color-felt-light)_0%,var(--color-felt)_78%)] px-4 py-6 shadow-[inset_0_2px_18px_rgba(0,0,0,0.55)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-100/60">
          第{handNumber}ハンド ・ {STREET_LABEL[phase] ?? phase}
        </p>

        <div className="flex gap-1.5">
          {communityCards.map((c) => (
            <CardView key={c} card={c} size="sm" animate />
          ))}
          {Array.from({ length: 5 - communityCards.length }).map((_, i) => (
            <CardSlot key={`slot-${i}`} size="sm" />
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-full bg-black/35 px-4 py-1.5 text-sm text-emerald-50">
          <span className="text-emerald-200/70">ポット</span>
          <ChipAmount amount={potCollected} />
        </div>
      </div>

      {/* 自分側(seatIndex最小)の席 */}
      {heroSeat && (
        <Seat
          player={toSeatPlayer(heroSeat)}
          isActive={heroSeat.id === activePlayerId}
          isButton={heroSeat.id === dealerButtonPlayerId}
        />
      )}

      {/* cards を含む Player を props に流さない(STATE_MACHINE 4 不変条件) */}
      {activePlayer && (
        <HandoffFlow activePlayer={{ id: activePlayer.id, name: activePlayer.name }} />
      )}
    </div>
  );
}
