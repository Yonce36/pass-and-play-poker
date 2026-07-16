'use client';

import { useEffect, useRef, useState } from 'react';
import { selectVisibleCards, useGameStore } from '@/store/gameStore';
import type { Player } from '@/types';
import { CardBack, CardView } from './CardView';
import { ActionPanel } from './ActionPanel';

/**
 * handoff画面に渡してよいプレイヤー情報。
 * STATE_MACHINE 4 不変条件「locked / confirm / pinEntry では cards を props にも渡さない」のため、
 * cards を含む Player をそのまま props に流さず、必ずこの型に絞る。
 */
type SafePlayer = Pick<Player, 'id' | 'name'>;

const toSafe = (p: Pick<Player, 'id' | 'name'>): SafePlayer => ({ id: p.id, name: p.name });

/** confirm/pinEntry/reveal を覆う全画面オーバーレイ(不透明。背後のテーブル情報も遮蔽する) */
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-screen-fade fixed inset-0 z-50 flex flex-col bg-zinc-950 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {children}
    </div>
  );
}

/** idle / locked: 次に行動するプレイヤーへ端末を渡す案内(テーブルの下に出るバー) */
function PassScreen({ target }: { target: SafePlayer }) {
  const beginHandoff = useGameStore((s) => s.beginHandoff);
  return (
    <div className="animate-screen-fade mt-auto flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/85 p-4 text-center">
      <p className="text-sm text-zinc-400">
        端末を <span className="font-bold text-gold">{target.name}</span> さんに渡してください
      </p>
      <button
        type="button"
        onClick={() => beginHandoff(target.id)}
        className="w-full max-w-xs rounded-full bg-emerald-600 py-3.5 text-lg font-bold text-white shadow-lg shadow-emerald-950/50 active:scale-[0.98] active:bg-emerald-700"
      >
        {target.name} です — 受け取りました
      </button>
    </div>
  );
}

/** confirm1: 本人確認(PINなし) */
function ConfirmIdentityScreen({ target }: { target: SafePlayer }) {
  const confirmIdentity = useGameStore((s) => s.confirmIdentity);
  const lock = useGameStore((s) => s.lock);
  return (
    <Overlay>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
        <div className="flex -space-x-6 opacity-80">
          <CardBack size="lg" />
          <CardBack size="lg" />
        </div>
        <h2 className="text-2xl font-bold">
          あなたは <span className="text-gold">{target.name}</span> さんですか？
        </h2>
        <button
          type="button"
          onClick={confirmIdentity}
          className="w-full max-w-xs rounded-full bg-emerald-600 py-3.5 text-lg font-bold text-white shadow-lg shadow-emerald-950/50 active:scale-[0.98] active:bg-emerald-700"
        >
          はい、{target.name} です
        </button>
        <button type="button" onClick={lock} className="text-sm text-zinc-500 underline">
          違います（戻る）
        </button>
      </div>
    </Overlay>
  );
}

/** pinEntry: PIN入力(4桁一致で reveal、不一致は pinAttempts++)。PIN照合は store 側で行う */
function PinEntryScreen({ target, pinAttempts }: { target: SafePlayer; pinAttempts: number }) {
  const submitPin = useGameStore((s) => s.submitPin);
  const lock = useGameStore((s) => s.lock);
  const [pin, setPin] = useState('');

  return (
    <Overlay>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <h2 className="text-2xl font-bold">
          <span className="text-gold">{target.name}</span> さんのPINを入力
        </h2>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="w-36 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-3xl tracking-[0.5em] text-white focus:border-gold focus:outline-none"
        />
        {pinAttempts > 0 && (
          <p className="text-sm text-red-500">PINが違います（{pinAttempts}回目）</p>
        )}
        <button
          type="button"
          disabled={pin.length !== 4}
          onClick={() => {
            submitPin(pin);
            setPin('');
          }}
          className="w-full max-w-xs rounded-full bg-emerald-600 py-3.5 text-lg font-bold text-white shadow-lg shadow-emerald-950/50 active:scale-[0.98] disabled:opacity-40"
        >
          確認
        </button>
        <button type="button" onClick={lock} className="text-sm text-zinc-500 underline">
          戻る
        </button>
      </div>
    </Overlay>
  );
}

/** confirm2: 一方向スワイプで reveal(range を右端まで動かしたときのみ発火) */
function SwipeRevealScreen({ target }: { target: SafePlayer }) {
  const revealCards = useGameStore((s) => s.revealCards);
  const [value, setValue] = useState(0);

  return (
    <Overlay>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
        <div className="flex -space-x-6">
          <CardBack size="lg" />
          <CardBack size="lg" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">
            <span className="text-gold">{target.name}</span> さん、準備はいいですか？
          </h2>
          <p className="mt-2 text-sm text-zinc-400">まわりに見られていないか確認してください</p>
        </div>
        <div className="w-full max-w-xs">
          <div className="relative flex h-14 items-center overflow-hidden rounded-full border border-white/10 bg-zinc-900">
            <div
              className="absolute inset-y-0 left-0 bg-emerald-700/60 transition-[width] duration-75"
              style={{ width: `${value}%` }}
            />
            <span className="pointer-events-none relative z-10 w-full text-sm font-semibold tracking-wide text-zinc-300">
              スライドして手札を表示 →
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={value}
              onChange={(e) => {
                const v = Number(e.target.value);
                setValue(v);
                if (v >= 95) revealCards();
              }}
              className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
              aria-label="スライドして手札を表示"
            />
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/** reveal: 自分の手札 + アクションパネル。history制御でブラウザバックによる再表示を防ぐ(STATE_MACHINE 4不変条件) */
function RevealScreen({ viewer }: { viewer: SafePlayer }) {
  const cards = useGameStore(selectVisibleCards);
  const lock = useGameStore((s) => s.lock);
  const concealCards = useGameStore((s) => s.concealCards);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!pushedRef.current) {
      history.pushState({ handoffReveal: true }, '');
      pushedRef.current = true;
    }
    const onPopState = () => lock();
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (pushedRef.current && history.state?.handoffReveal) {
        history.back();
      }
      pushedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Overlay>
      <div className="flex flex-1 flex-col items-center gap-5 overflow-y-auto p-5">
        <p className="text-sm text-zinc-400">
          <span className="font-bold text-gold">{viewer.name}</span> さんの手札
        </p>
        <div className="flex gap-3">
          {cards?.map((c) => <CardView key={c} card={c} size="lg" animate />)}
        </div>
        <ActionPanel viewerId={viewer.id} />
        <button
          type="button"
          onClick={concealCards}
          className="mt-auto pb-2 text-sm text-zinc-500 underline"
        >
          伏せる（アクションしない）
        </button>
      </div>
    </Overlay>
  );
}

/** phase が betting phase のときの handoff 状態機械の描画(idle/locked/confirm1/confirm2/pinEntry/reveal) */
export function HandoffFlow({ activePlayer }: { activePlayer: SafePlayer }) {
  const handoff = useGameStore((s) => s.handoff);
  const players = useGameStore((s) => s.players);

  const targetPlayer = handoff.targetPlayerId
    ? players.find((p) => p.id === handoff.targetPlayerId)
    : undefined;
  // cards を含む Player を子コンポーネントへ流さない(STATE_MACHINE 4 不変条件)
  const target = targetPlayer ? toSafe(targetPlayer) : undefined;

  switch (handoff.step) {
    case 'idle':
    case 'locked':
      return <PassScreen target={toSafe(activePlayer)} />;
    case 'confirm1':
      return target ? <ConfirmIdentityScreen target={target} /> : null;
    case 'confirm2':
      return target ? <SwipeRevealScreen target={target} /> : null;
    case 'pinEntry':
      return target ? <PinEntryScreen target={target} pinAttempts={handoff.pinAttempts} /> : null;
    case 'reveal':
      return target ? <RevealScreen viewer={target} /> : null;
    default:
      return null;
  }
}
