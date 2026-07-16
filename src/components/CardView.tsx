import type { Card } from '@/types';

const SUIT_SYMBOL: Record<string, string> = { H: '♥', D: '♦', C: '♣', S: '♠' };
const RED_SUITS = new Set(['H', 'D']);

function formatRank(rank: string): string {
  return rank === 'T' ? '10' : rank;
}

type CardSize = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<CardSize, string> = {
  sm: 'h-14 w-10 rounded-md text-[11px]',
  md: 'h-[72px] w-[52px] rounded-lg text-sm',
  lg: 'h-24 w-[68px] rounded-lg text-base',
};

const CENTER_SUIT_CLASS: Record<CardSize, string> = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
};

/**
 * 1枚の表向きカード。呼び出し側が「表示してよい手札/公開カード」であることを保証すること。
 * dimmed はショーダウンで役に使われなかったカードの減光表示。
 */
export function CardView({
  card,
  size = 'md',
  dimmed = false,
  animate = false,
}: {
  card: Card;
  size?: CardSize;
  dimmed?: boolean;
  animate?: boolean;
}) {
  const suit = card[0];
  const rank = formatRank(card.slice(1));
  const color = RED_SUITS.has(suit) ? 'text-red-600' : 'text-zinc-900';

  return (
    <div
      className={`relative flex flex-col justify-between bg-white p-1 font-bold shadow-md shadow-black/40 ring-1 ring-black/10 ${SIZE_CLASS[size]} ${color} ${
        dimmed ? 'opacity-35 saturate-50' : ''
      } ${animate ? 'animate-card-in' : ''}`}
    >
      <div className="leading-none">
        <div>{rank}</div>
        <div className="-mt-0.5">{SUIT_SYMBOL[suit]}</div>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center ${CENTER_SUIT_CLASS[size]}`}>
        {SUIT_SYMBOL[suit]}
      </div>
      <div className="rotate-180 leading-none">
        <div>{rank}</div>
        <div className="-mt-0.5">{SUIT_SYMBOL[suit]}</div>
      </div>
    </div>
  );
}

/**
 * カード裏面。純粋な装飾で、カード情報は一切持たない(手札漏洩防止のため
 * 実際の Card 値を受け取らない設計にしている)。
 */
export function CardBack({ size = 'md' }: { size?: CardSize }) {
  return (
    <div
      className={`flex items-center justify-center border-2 border-white/70 bg-gradient-to-br from-blue-800 to-blue-950 shadow-md shadow-black/40 ${SIZE_CLASS[size]}`}
    >
      <div className="flex h-[70%] w-[65%] items-center justify-center rounded-sm border border-blue-400/40 bg-[repeating-linear-gradient(45deg,#1e3a8a_0px,#1e3a8a_3px,#172554_3px,#172554_6px)]">
        <span className="text-[10px] text-blue-300/70">♠</span>
      </div>
    </div>
  );
}

/** コミュニティカードの空きスロット */
export function CardSlot({ size = 'md' }: { size?: CardSize }) {
  return (
    <div
      className={`border border-dashed border-white/20 bg-black/15 ${SIZE_CLASS[size]}`}
      aria-hidden
    />
  );
}

/** チップ額の表示(色付きトークン+数字) */
export function ChipAmount({ amount, className = '' }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="relative inline-block h-4 w-4 rounded-full border-[2.5px] border-dashed border-white/80 bg-gradient-to-br from-rose-500 to-rose-700 shadow-sm" />
      <span className="font-mono font-semibold tabular-nums">{amount.toLocaleString()}</span>
    </span>
  );
}
