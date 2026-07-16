// Phase 8: startGame境界でのconfigバリデーション（SPEC 2: BB>SB、startingChips>BB、すべて正整数）
// 独立レビューW-1対応。tests/store.test.ts と同じ localStorage セットアップが必要。
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const backing = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return backing.size;
    },
    clear: () => backing.clear(),
    getItem: (key: string) => (backing.has(key) ? backing.get(key)! : null),
    key: (index: number) => Array.from(backing.keys())[index] ?? null,
    removeItem: (key: string) => {
      backing.delete(key);
    },
    setItem: (key: string, value: string) => {
      backing.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
});

import { validateGameConfig, useGameStore } from '@/store/gameStore';
import type { GameConfig } from '@/types';

const BASE: GameConfig = {
  smallBlind: 10,
  bigBlind: 20,
  startingChips: 1000,
  minPlayers: 2,
  maxPlayers: 6,
  allowedPlayerCount: 2,
  timerEnabled: false,
  timerDurationSec: 30,
  oddChipRule: 'clockwiseFromButton',
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('validateGameConfig（SPEC 2）', () => {
  it('デフォルト値は合法', () => {
    expect(() => validateGameConfig(BASE)).not.toThrow();
  });

  it('bigBlind === smallBlind は不合格（BB > SB の境界）', () => {
    expect(() => validateGameConfig({ ...BASE, smallBlind: 20, bigBlind: 20 })).toThrow();
  });

  it('bigBlind > smallBlind ぎりぎり(+1)は合格', () => {
    expect(() => validateGameConfig({ ...BASE, smallBlind: 20, bigBlind: 21, startingChips: 1000 })).not.toThrow();
  });

  it('startingChips === bigBlind は不合格（startingChips > BB の境界）', () => {
    expect(() => validateGameConfig({ ...BASE, startingChips: 20, bigBlind: 20 })).toThrow();
  });

  it('startingChips > bigBlind ぎりぎり(+1)は合格', () => {
    expect(() => validateGameConfig({ ...BASE, bigBlind: 20, startingChips: 21 })).not.toThrow();
  });

  it.each([
    ['smallBlind', { smallBlind: 0 }],
    ['smallBlind', { smallBlind: -10 }],
    ['smallBlind', { smallBlind: 10.5 }],
    ['bigBlind', { bigBlind: 0 }],
    ['bigBlind', { bigBlind: -20 }],
    ['bigBlind', { bigBlind: 20.5 }],
    ['startingChips', { startingChips: 0 }],
    ['startingChips', { startingChips: -1000 }],
    ['startingChips', { startingChips: 999.9 }],
  ])('%s が正整数でなければ不合格: %o', (_name, override) => {
    expect(() => validateGameConfig({ ...BASE, ...override })).toThrow();
  });
});

describe('startGame境界でのバリデーション（UIだけでなくstore境界でもthrowする）', () => {
  it('bigBlind <= smallBlind な configOverrides を渡すとstartGameがthrowし、stateは変化しない', () => {
    const before = useGameStore.getState();
    expect(() =>
      useGameStore.getState().startGame(['Alice', 'Bob'], { smallBlind: 20, bigBlind: 20 }),
    ).toThrow();
    expect(useGameStore.getState().phase).toBe(before.phase);
    expect(useGameStore.getState().players).toEqual(before.players);
  });

  it('startingChips <= bigBlind な configOverrides を渡すとstartGameがthrowする', () => {
    expect(() =>
      useGameStore.getState().startGame(['Alice', 'Bob'], { startingChips: 20, bigBlind: 20 }),
    ).toThrow();
  });

  it('正の整数でないconfigOverridesを渡すとstartGameがthrowする', () => {
    expect(() => useGameStore.getState().startGame(['Alice', 'Bob'], { smallBlind: -1 })).toThrow();
  });

  it('合法なconfigOverridesならstartGameは成功しpreflopになる', () => {
    useGameStore.getState().startGame(['Alice', 'Bob'], { smallBlind: 5, bigBlind: 10, startingChips: 500 });
    expect(useGameStore.getState().phase).toBe('preflop');
  });
});
