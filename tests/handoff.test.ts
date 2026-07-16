// Phase 8: handoff状態遷移とselectVisibleCardsのテスト（STATE_MACHINE 4、CLAUDE.md 手札漏洩防止）
// tests/store.test.ts と同じ localStorage セットアップが必要（gameStore.ts がモジュール読み込み時に
// createJSONStorage(() => window.localStorage) を同期評価するため）。
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

import { selectVisibleCards, useGameStore } from '@/store/gameStore';

/** 固定シードのLCG（tests/store.test.ts の makeRandom と同一アルゴリズム） */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.getState().startGame(['Alice', 'Bob'], undefined, makeRandom(1));
});

describe('selectVisibleCards: reveal以外は常にnull（CLAUDE.md 手札漏洩防止の不変条件）', () => {
  it('初期状態(locked)ではnull', () => {
    expect(selectVisibleCards(useGameStore.getState())).toBeNull();
  });

  it('idle/confirm1/confirm2/pinEntryのいずれもnull', () => {
    const activeId = useGameStore.getState().activePlayerId!;
    useGameStore.getState().beginHandoff(activeId);
    expect(useGameStore.getState().handoff.step).toBe('confirm1');
    expect(selectVisibleCards(useGameStore.getState())).toBeNull();

    useGameStore.getState().confirmIdentity();
    expect(useGameStore.getState().handoff.step).toBe('confirm2');
    expect(selectVisibleCards(useGameStore.getState())).toBeNull();
  });

  it('revealのときのみ対象プレイヤーの手札を返す', () => {
    const activeId = useGameStore.getState().activePlayerId!;
    useGameStore.getState().beginHandoff(activeId);
    useGameStore.getState().confirmIdentity();
    useGameStore.getState().revealCards();

    const s = useGameStore.getState();
    expect(s.handoff.step).toBe('reveal');
    const visible = selectVisibleCards(s);
    const target = s.players.find((p) => p.id === activeId)!;
    expect(visible).toEqual(target.cards);
    // 相手の手札はselectorを通しても取得できない
    const other = s.players.find((p) => p.id !== activeId)!;
    expect(visible).not.toEqual(other.cards);
  });
});

describe('handoff状態遷移: idle/locked -> confirm1 -> confirm2 -> reveal -> idle（PINなし、STATE_MACHINE 4）', () => {
  it('一連の遷移が正しく行われる', () => {
    const activeId = useGameStore.getState().activePlayerId!;

    useGameStore.getState().beginHandoff(activeId);
    expect(useGameStore.getState().handoff).toMatchObject({
      step: 'confirm1',
      targetPlayerId: activeId,
      currentViewerPlayerId: null,
    });

    useGameStore.getState().confirmIdentity();
    expect(useGameStore.getState().handoff.step).toBe('confirm2');

    useGameStore.getState().revealCards();
    expect(useGameStore.getState().handoff).toMatchObject({
      step: 'reveal',
      targetPlayerId: activeId,
      currentViewerPlayerId: activeId,
    });

    useGameStore.getState().concealCards();
    expect(useGameStore.getState().handoff).toEqual({
      step: 'idle',
      targetPlayerId: null,
      currentViewerPlayerId: null,
      pinAttempts: 0,
    });
  });

  it('不正な遷移(confirm1を経ずにconfirmIdentity等)はエラーを投げる', () => {
    expect(() => useGameStore.getState().confirmIdentity()).toThrow();
    expect(() => useGameStore.getState().revealCards()).toThrow();
    expect(() => useGameStore.getState().concealCards()).toThrow();
  });
});

describe('lock: 任意の状態からlockedへ強制遷移する（visibilitychange/blur/pagehide用、STATE_MACHINE 4）', () => {
  it('reveal中でもlock()でlockedに落ち、手札はselectVisibleCardsからも見えなくなる', () => {
    const activeId = useGameStore.getState().activePlayerId!;
    useGameStore.getState().beginHandoff(activeId);
    useGameStore.getState().confirmIdentity();
    useGameStore.getState().revealCards();
    expect(useGameStore.getState().handoff.step).toBe('reveal');

    useGameStore.getState().lock();
    const s = useGameStore.getState();
    expect(s.handoff.step).toBe('locked');
    expect(s.handoff.currentViewerPlayerId).toBeNull();
    expect(selectVisibleCards(s)).toBeNull();
  });
});

describe('PINあり: pinEntryへ遷移し、不一致でpinAttemptsが増える。一致でrevealになる（STATE_MACHINE 4）', () => {
  it('PIN一致・不一致の両方を検証する', () => {
    useGameStore.setState((state) => ({
      players: state.players.map((p) => (p.id === state.activePlayerId ? { ...p, pin: '1234' } : p)),
    }));
    const activeId = useGameStore.getState().activePlayerId!;

    useGameStore.getState().beginHandoff(activeId);
    expect(useGameStore.getState().handoff.step).toBe('pinEntry');

    useGameStore.getState().submitPin('0000');
    let s = useGameStore.getState();
    expect(s.handoff.step).toBe('pinEntry');
    expect(s.handoff.pinAttempts).toBe(1);

    useGameStore.getState().submitPin('9999');
    s = useGameStore.getState();
    expect(s.handoff.step).toBe('pinEntry');
    expect(s.handoff.pinAttempts).toBe(2);

    useGameStore.getState().submitPin('1234');
    s = useGameStore.getState();
    expect(s.handoff.step).toBe('reveal');
    expect(s.handoff.currentViewerPlayerId).toBe(activeId);
    expect(selectVisibleCards(s)).toEqual(s.players.find((p) => p.id === activeId)!.cards);
  });
});
