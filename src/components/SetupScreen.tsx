'use client';

import { useState, type FormEvent } from 'react';
import { useGameStore, validateGameConfig } from '@/store/gameStore';
import type { GameConfig } from '@/types';

const DEFAULTS = { startingChips: 1000, smallBlind: 10, bigBlind: 20 };

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
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-center text-2xl font-bold">Pass & Play Poker</h1>

      <label className="flex flex-col gap-1 text-sm font-medium">
        プレイヤー1の名前
        <input
          type="text"
          value={name1}
          onChange={(e) => setName1(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
          maxLength={20}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        プレイヤー2の名前
        <input
          type="text"
          value={name2}
          onChange={(e) => setName2(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
          maxLength={20}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        初期チップ
        <input
          type="number"
          inputMode="numeric"
          value={startingChips}
          onChange={(e) => setStartingChips(Number(e.target.value))}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          スモールブラインド
          <input
            type="number"
            inputMode="numeric"
            value={smallBlind}
            onChange={(e) => setSmallBlind(Number(e.target.value))}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          ビッグブラインド
          <input
            type="number"
            inputMode="numeric"
            value={bigBlind}
            onChange={(e) => setBigBlind(Number(e.target.value))}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" className="rounded-full bg-emerald-600 py-3 text-lg font-semibold text-white active:bg-emerald-700">
        ゲーム開始
      </button>
    </form>
  );
}
