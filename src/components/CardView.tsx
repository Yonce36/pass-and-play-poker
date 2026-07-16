import type { Card } from '@/types';

const SUIT_SYMBOL: Record<string, string> = { H: '♥', D: '♦', C: '♣', S: '♠' };
const RED_SUITS = new Set(['H', 'D']);

function formatRank(rank: string): string {
  return rank === 'T' ? '10' : rank;
}

/** 1枚の表向きカードを描画する。呼び出し側が reveal 対象の手札であることを保証すること */
export function CardView({ card }: { card: Card }) {
  const suit = card[0];
  const rank = card.slice(1);
  const isRed = RED_SUITS.has(suit);
  return (
    <div
      className={`flex h-14 w-10 flex-col items-center justify-center rounded-md border border-zinc-300 bg-white text-sm font-bold shadow-sm ${
        isRed ? 'text-red-600' : 'text-zinc-900'
      }`}
    >
      <span>{formatRank(rank)}</span>
      <span className="text-base leading-none">{SUIT_SYMBOL[suit]}</span>
    </div>
  );
}
