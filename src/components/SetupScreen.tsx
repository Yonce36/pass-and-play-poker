'use client';

import { useState, type FormEvent } from 'react';
import { useGameStore, validateGameConfig } from '@/store/gameStore';
import type { GameConfig } from '@/types';
import { CardBack } from './CardView';

const DEFAULTS = { startingChips: 1000, smallBlind: 10, bigBlind: 20 };

const inputClass =
  'rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-white focus:border-gold focus:outline-none';

export function SetupScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const [name1, setName1] = useState('プレイヤー1');
  const [name2, setName2] = useState('プレイヤー2');
  const [startingChips, setStartingChips] = useState(DEFAULTS.startingChips);
  const [smallBlind, setSmallBlind] = useState(DEFAULTS.smallBlind);
  const [bigBlind, setBigBlind] = useState(DEFAULTS.bigBlind);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const configOverrides: Partial<GameConfig> = { startingChips, smallBlind, bigBlind };
    try {
      validateGameConfig({
        smallBlind,
        bigBlind,
        startingChips,
        minPlayers: 2,
        maxPlayers: 6,
        allowedPlayerCount: 2,
        timerEnabled: false,
        timerDurationSec: 30,
        oddChipRule: 'clockwiseFromButton',
      });
      startGame([name1.trim() || 'プレイヤー1', name2.trim() || 'プレイヤー2'], configOverrides);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-screen-fade mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 p-6"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex -space-x-8">
          <div className="-rotate-6">
            <CardBack size="md" />
          </div>
          <div className="rotate-6">
            <CardBack size="md" />
          </div>
        </div>
        <h1 className="text-center text-3xl font-black tracking-tight">
          Pass & Play <span className="text-gold">Poker</span>
        </h1>
        <p className="text-center text-xs text-zinc-500">
          1台のスマホを手渡しして遊ぶテキサスホールデム
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          プレイヤー
        </p>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-300">
          プレイヤー1の名前
          <input
            type="text"
            value={name1}
            onChange={(e) => setName1(e.target.value)}
            className={inputClass}
            maxLength={20}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-300">
          プレイヤー2の名前
          <input
            type="text"
            value={name2}
            onChange={(e) => setName2(e.target.value)}
            className={inputClass}
            maxLength={20}
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          テーブル設定
        </p>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-300">
          初期チップ
          <input
            type="number"
            inputMode="numeric"
            value={startingChips}
            onChange={(e) => setStartingChips(Number(e.target.value))}
            className={inputClass}
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-zinc-300">
            SB
            <input
              type="number"
              inputMode="numeric"
              value={smallBlind}
              onChange={(e) => setSmallBlind(Number(e.target.value))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-zinc-300">
            BB
            <input
              type="number"
              inputMode="numeric"
              value={bigBlind}
              onChange={(e) => setBigBlind(Number(e.target.value))}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        className="rounded-full bg-emerald-600 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-950/50 active:scale-[0.98] active:bg-emerald-700"
      >
        ゲーム開始
      </button>
    </form>
  );
}
