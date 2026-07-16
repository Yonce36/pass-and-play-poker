'use client';

import { useEffect, useRef, useState } from 'react';
import { selectVisibleCards, useGameStore } from '@/store/gameStore';
import type { Player } from '@/types';
import { CardView } from './CardView';
import { ActionPanel } from './ActionPanel';

/**
 * handoff画面に渡してよいプレイヤー情報。
 * STATE_MACHINE 4 不変条件「locked / confirm / pinEntry では cards を props にも渡さない」のため、
 * cards を含む Player をそのまま props に流さず、必ずこの型に絞る。
 */
type SafePlayer = Pick<Player, 'id' | 'name'>;

const toSafe = (p: Pick<Player, 'id' | 'name'>): SafePlayer => ({ id: p.id, name: p.name });

/** idle / locked: 次に行動するプレイヤーへ端末を渡す案内画面（STATE_MACHINE 4） */
function PassScreen({ target }: { target: SafePlayer }) {
  const beginHandoff = useGameStore((s) => s.beginHandoff);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <p className="text-sm text-zinc-500">端末を次のプレイヤーに渡してください</p>
      <h2 className="text-2xl font-bold">{target.name} さんの番です</h2>
      <button
        type="button"
        onClick={() => beginHandoff(target.id)}
        className="rounded-full bg-emerald-600 px-8 py-3 text-lg font-semibold text-white active:bg-emerald-700"
      >
        端末を受け取りました
      </button>
    </div>
  );
}

/** confirm1: 本人確認（PINなし） */
function ConfirmIdentityScreen({ target }: { target: SafePlayer }) {
  const confirmIdentity = useGameStore((s) => s.confirmIdentity);
  const lock = useGameStore((s) => s.lock);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h2 className="text-2xl font-bold">あなたは {target.name} さんですか？</h2>
      <button
        type="button"
        onClick={confirmIdentity}
        className="rounded-full bg-emerald-600 px-8 py-3 text-lg font-semibold text-white active:bg-emerald-700"
      >
        はい、{target.name} です
      </button>
      <button type="button" onClick={lock} className="text-sm text-zinc-500 underline">
        違います（戻る）
      </button>
    </div>
  );
}

/** pinEntry: PIN入力（4桁一致で reveal、不一致は pinAttempts++）。PIN照合は store 側で行う */
function PinEntryScreen({ target, pinAttempts }: { target: SafePlayer; pinAttempts: number }) {
  const submitPin = useGameStore((s) => s.submitPin);
  const lock = useGameStore((s) => s.lock);
  const [pin, setPin] = useState('');

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h2 className="text-2xl font-bold">{target.name} さんのPINを入力してください</h2>
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="w-32 rounded-md border border-zinc-300 px-4 py-3 text-center text-2xl tracking-widest"
      />
      {pinAttempts > 0 && <p className="text-sm text-red-600">PINが違います（{pinAttempts}回目）</p>}
      <button
        type="button"
        disabled={pin.length !== 4}
        onClick={() => {
          submitPin(pin);
          setPin('');
        }}
        className="rounded-full bg-emerald-600 px-8 py-3 text-lg font-semibold text-white disabled:opacity-40"
      >
        確認
      </button>
      <button type="button" onClick={lock} className="text-sm text-zinc-500 underline">
        戻る
      </button>
    </div>
  );
}

/** confirm2: 一方向スワイプで reveal（誤操作で戻れないよう range を右端まで動かしたときのみ発火） */
function SwipeRevealScreen({ target }: { target: SafePlayer }) {
  const revealCards = useGameStore((s) => s.revealCards);
  const [value, setValue] = useState(0);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h2 className="text-2xl font-bold">{target.name} さん、準備はいいですか？</h2>
      <p className="text-sm text-zinc-500">右端までスライドすると手札が表示されます</p>
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
        className="w-64"
        aria-label="スライドして手札を表示"
      />
    </div>
  );
}

/** reveal: 自分の手札 + アクションパネル。history制御でブラウザバックによる再表示を防ぐ（STATE_MACHINE 4不変条件） */
function RevealScreen({ viewer }: { viewer: SafePlayer }) {
  const cards = useGameStore(selectVisibleCards);
  const lock = useGameStore((s) => s.lock);
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
    <div className="flex flex-1 flex-col items-center gap-6 p-6">
      <h2 className="text-lg font-semibold">{viewer.name} さんの手札</h2>
      <div className="flex gap-3">{cards?.map((c) => <CardView key={c} card={c} />)}</div>
      <ActionPanel viewerId={viewer.id} />
    </div>
  );
}

/** phase が betting phase のときの handoff 状態機械の描画（idle/locked/confirm1/confirm2/pinEntry/reveal） */
export function HandoffFlow({ activePlayer }: { activePlayer: SafePlayer }) {
  const handoff = useGameStore((s) => s.handoff);
  const players = useGameStore((s) => s.players);

  const targetPlayer = handoff.targetPlayerId
    ? players.find((p) => p.id === handoff.targetPlayerId)
    : undefined;
  // cards を含む Player を子コンポーネントへ流さない（STATE_MACHINE 4 不変条件）
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
