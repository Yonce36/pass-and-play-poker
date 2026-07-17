// Phase 6: sidePot / showdown のテスト（SPEC 4.4 / 4.5 / 7 準拠、テスト先行）
// SPEC 7: テスト入力は betting エンジンの実出力を使う（postBlinds → applyAction の列で状態を作る）
import { describe, expect, it } from 'vitest';
import { applyAction, postBlinds } from '../src/betting';
import { createDeck } from '../src/deck';
import { evaluateHand } from '../src/handEval';
import { buildPots } from '../src/sidePot';
import { distributePots } from '../src/showdown';
import type { Card, GameConfig, GameState, HandResult, Player } from '../src/types';

const CONFIG: GameConfig = {
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

// コミュニティはこの5枚に固定される（ハイカードボード。フラッシュ・ストレートなし）
const BOARD: Card[] = ['H2', 'D7', 'C9', 'SK', 'HA'];

function makePlayer(id: string, seatIndex: number, chips: number, cards: Card[]): Player {
  return {
    id,
    seatIndex,
    name: id,
    pin: null,
    chips,
    currentBet: 0,
    totalContribution: 0,
    cards,
    status: 'active',
    hasActedThisRound: false,
    hasOption: false,
  };
}

function makeState(players: Player[], dealerButtonPlayerId: string): GameState {
  const used = new Set<Card>(BOARD);
  return {
    handNumber: 1,
    phase: 'postingBlinds',
    config: CONFIG,
    players,
    activePlayerId: null,
    dealerButtonPlayerId,
    betting: {
      actingOrder: [],
      currentMaxBet: 0,
      minRaiseTo: 0,
      lastFullRaiseAmount: 0,
      lastAggressorPlayerId: null,
      firstActorPlayerId: null,
    },
    pots: [],
    communityCards: [],
    deck: [...BOARD, ...createDeck().filter((c) => !used.has(c))],
    handoff: {
      step: 'idle',
      targetPlayerId: null,
      currentViewerPlayerId: null,
      pinAttempts: 0,
    },
    timer: {
      enabled: false,
      durationSec: 30,
      remainingSec: 30,
      timeoutAction: 'autoCheckOrFold',
      isPaused: true,
    },
    actionLog: [],
  };
}

/** showdown 状態から、非foldプレイヤーの HandResult を作る */
function showdownResults(s: GameState): HandResult[] {
  return s.players
    .filter((p) => p.status === 'active' || p.status === 'allIn')
    .map((p) => evaluateHand(p.id, p.cards, s.communityCards));
}

function totalPot(pots: { amount: number }[]): number {
  return pots.reduce((sum, p) => sum + p.amount, 0);
}

describe('2人 all-in（同額）→ 単一ポット', () => {
  function run(): GameState {
    // sb(=ボタン): AA でトリップス / bb: ハイカード
    let s = makeState(
      [makePlayer('sb', 0, 1000, ['SA', 'DA']), makePlayer('bb', 1, 1000, ['H3', 'D4'])],
      'sb',
    );
    s = postBlinds(s);
    s = applyAction(s, { playerId: 'sb', type: 'allIn' });
    s = applyAction(s, { playerId: 'bb', type: 'allIn' });
    return s;
  }

  it('同額 all-in で余分なレイヤーが生まれない（ポットは1つ）', () => {
    const s = run();
    expect(s.phase).toBe('showdown');
    const pots = buildPots(s.players);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(2000);
    expect([...pots[0].eligiblePlayerIds].sort()).toEqual(['bb', 'sb']);
  });

  it('勝者が全額を獲得する', () => {
    const s = run();
    const payouts = distributePots(buildPots(s.players), showdownResults(s), s.players, 'sb');
    expect(payouts).toEqual({ sb: 2000 });
  });
});

describe('2人 all-in（不等スタック）→ コールされなかった分のサイドポット', () => {
  function run(): GameState {
    // sb(=ボタン,1000): ハイカード / bb(600): 99 のペア（ボードC9でトリップス）
    let s = makeState(
      [makePlayer('sb', 0, 1000, ['H3', 'D4']), makePlayer('bb', 1, 600, ['S9', 'D9'])],
      'sb',
    );
    s = postBlinds(s);
    s = applyAction(s, { playerId: 'sb', type: 'allIn' }); // 到達額 1000
    s = applyAction(s, { playerId: 'bb', type: 'call' }); // 600 で short call all-in
    return s;
  }

  it('メイン1200（両者）＋サイド400（sbのみ）に分かれる', () => {
    const s = run();
    const pots = buildPots(s.players);
    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(1200);
    expect([...pots[0].eligiblePlayerIds].sort()).toEqual(['bb', 'sb']);
    expect(pots[0].sourceContributionLevel).toBe(600);
    expect(pots[1].amount).toBe(400);
    expect(pots[1].eligiblePlayerIds).toEqual(['sb']);
  });

  it('メインは bb、サイドは敗者 sb に戻る（実質返還）', () => {
    const s = run();
    const payouts = distributePots(buildPots(s.players), showdownResults(s), s.players, 'sb');
    expect(payouts).toEqual({ bb: 1200, sb: 400 });
    expect(totalPot(buildPots(s.players))).toBe(1600);
  });
});

describe('3人 all-in（不等スタック）→ 複数サイドポット・メインとサイドで勝者相違', () => {
  function run(): GameState {
    // a(btn,100): AA → メイン勝ち / b(sb,300): KK → サイド勝ち / c(bb,1000): ハイカード
    let s = makeState(
      [
        makePlayer('a', 0, 100, ['SA', 'DA']),
        makePlayer('b', 1, 300, ['HK', 'DK']),
        makePlayer('c', 2, 1000, ['C4', 'D5']),
      ],
      'a',
    );
    s = postBlinds(s); // sb=b(10), bb=c(20)。preflop は a(btn=UTG) から
    s = applyAction(s, { playerId: 'a', type: 'allIn' }); // 100（フルレイズ）
    s = applyAction(s, { playerId: 'b', type: 'allIn' }); // 300（フルレイズ）
    s = applyAction(s, { playerId: 'c', type: 'call' }); // 300 に揃える
    return s;
  }

  it('メイン300（a,b,c）＋サイド400（b,c）が生成される', () => {
    const s = run();
    expect(s.phase).toBe('showdown');
    const pots = buildPots(s.players);
    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(300);
    expect([...pots[0].eligiblePlayerIds].sort()).toEqual(['a', 'b', 'c']);
    expect(pots[0].sourceContributionLevel).toBe(100);
    expect(pots[1].amount).toBe(400);
    expect([...pots[1].eligiblePlayerIds].sort()).toEqual(['b', 'c']);
    expect(pots[1].sourceContributionLevel).toBe(300);
  });

  it('メインは a、サイドは b が獲得する（ポットごとに eligible のみで比較）', () => {
    const s = run();
    const payouts = distributePots(buildPots(s.players), showdownResults(s), s.players, 'a');
    expect(payouts).toEqual({ a: 300, b: 400 });
  });
});

describe('folded の拠出・チョップ・odd chip（SPEC 4.4 / 4.5）', () => {
  /**
   * 3人: btn は 45 拠出して fold。sb と bb は同一ペア（55）でチョップ。
   * ポット合計 2045 → 1022 ずつ + 端数1 はボタンから時計回りで最初の eligible（sb）へ。
   */
  function run(): GameState {
    let s = makeState(
      [
        makePlayer('btn', 0, 1000, ['C3', 'C6']),
        makePlayer('sb', 1, 1000, ['S5', 'D5']),
        makePlayer('bb', 2, 1000, ['C5', 'H5']),
      ],
      'btn',
    );
    s = postBlinds(s);
    // preflop: 全員 20 コール
    s = applyAction(s, { playerId: 'btn', type: 'call' });
    s = applyAction(s, { playerId: 'sb', type: 'call' });
    s = applyAction(s, { playerId: 'bb', type: 'check' });
    // flop: sb 25 bet、bb/btn コール
    s = applyAction(s, { playerId: 'sb', type: 'bet', amount: 25 });
    s = applyAction(s, { playerId: 'bb', type: 'call' });
    s = applyAction(s, { playerId: 'btn', type: 'call' });
    // turn: sb all-in、bb コール（all-in）、btn fold
    s = applyAction(s, { playerId: 'sb', type: 'allIn' });
    s = applyAction(s, { playerId: 'bb', type: 'call' });
    s = applyAction(s, { playerId: 'btn', type: 'fold' });
    return s;
  }

  it('folded のチップはポットに入るが eligible には入らない', () => {
    const s = run();
    expect(s.phase).toBe('showdown');
    const btn = s.players.find((p) => p.id === 'btn')!;
    expect(btn.status).toBe('folded');
    expect(btn.totalContribution).toBe(45);
    const pots = buildPots(s.players);
    // eligible が同一（sb,bb）の層は1つのポットに統合される
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(2045);
    expect([...pots[0].eligiblePlayerIds].sort()).toEqual(['bb', 'sb']);
  });

  it('チョップの端数はボタンから時計回りで最初の eligible へ', () => {
    const s = run();
    const payouts = distributePots(buildPots(s.players), showdownResults(s), s.players, 'btn');
    // 2045 → 1022 / 1022 + 端数1。ボタンの左隣 = sb が先
    expect(payouts).toEqual({ sb: 1023, bb: 1022 });
  });

  it('チップ保存則: payout 合計 = 拠出合計', () => {
    const s = run();
    const payouts = distributePots(buildPots(s.players), showdownResults(s), s.players, 'btn');
    const paid = Object.values(payouts).reduce((a, b) => a + b, 0);
    const contributed = s.players.reduce((a, p) => a + p.totalContribution, 0);
    expect(paid).toBe(contributed);
    expect(paid).toBe(2045);
  });
});

describe('buildPots の純粋性', () => {
  it('入力 players を変更しない', () => {
    let s = makeState(
      [makePlayer('sb', 0, 1000, ['SA', 'DA']), makePlayer('bb', 1, 600, ['S9', 'D9'])],
      'sb',
    );
    s = postBlinds(s);
    s = applyAction(s, { playerId: 'sb', type: 'allIn' });
    s = applyAction(s, { playerId: 'bb', type: 'call' });
    const snapshot = JSON.parse(JSON.stringify(s.players));
    buildPots(s.players);
    expect(s.players).toEqual(snapshot);
  });
});
