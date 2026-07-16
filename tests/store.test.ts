// Phase 7: Zustand store 統合のテスト（SPEC 4.6 / 5、STATE_MACHINE 1、テスト先行）
// src/store/gameStore.ts はまだ存在しない。このテストが定める API 契約に沿って実装する。
// テストデータは可能な限り betting エンジン（postBlinds）の実出力を使う（SPEC 7 の方針を store 層にも適用）。
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 実行環境の注記（テスト内容・アサーションとは無関係な環境セットアップ）:
// Node v26 は実験的な globalThis.localStorage アクセサ(--localstorage-fileなしだとundefinedを返す)を
// own property として最初から持つ。vitest の jsdom 環境は「global に既にあるキー」を明示的な許可リスト
// に含まれる場合のみ上書きする実装になっており、localStorage はその許可リストに含まれないため、
// jsdom 本来の動作する Storage 実装で上書きされず、window.localStorage(===globalThis.localStorage)は
// undefined のままになる（window と globalThis は同一オブジェクト）。
// さらに gameStore.ts は zustand の createJSONStorage(() => window.localStorage) を
// モジュール読み込み時に同期評価する（persist ミドルウェアが getStorage() を即時呼び出すため）ので、
// テストコード内で後から window.localStorage を代入しても手遅れになる。
// vi.hoisted は import 文より前に巻き上げて実行されるため、ここでダミーの Storage 実装を
// globalThis.localStorage に configurable な上書きとしてインストールしてから
// `@/store/gameStore` を import する。テストのアサーション内容・ケース数は変更しない。
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

import { postBlinds } from '@/core/betting';
import { createDeck, shuffleDeck } from '@/core/deck';
import { evaluateHand } from '@/core/handEval';
import { distributePots } from '@/core/showdown';
import { buildPots } from '@/core/sidePot';
import { selectHandCompleteView, useGameStore } from '@/store/gameStore';
import type { Card, GameConfig, GameState, Player } from '@/types';

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

// コミュニティはこの5枚に固定（ハイカードボード。HA を含むため sb=AA が常にスリーカードで勝つ）。
// tests/sidePot.test.ts の BOARD と同じ構成（既に評価結果が検証済みの組み合わせ）
const BOARD: Card[] = ['H2', 'D7', 'C9', 'SK', 'HA'];

/** 固定シードのLCG（決定的な注入乱数。0以上1未満を返す）。tests/deck.test.ts の makeLcg と同じアルゴリズム */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

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

/** sb(=ボタン, AA) vs bb(弱い手) のヘッズアップ preflop 状態。BOARD 上では sb が常に勝つ */
function buildHeadsUpPreflop(chips = 1000): GameState {
  return postBlinds(
    makeState(
      [makePlayer('sb', 0, chips, ['SA', 'DA']), makePlayer('bb', 1, chips, ['H3', 'D4'])],
      'sb',
    ),
  );
}

const player = (s: GameState, id: string) => s.players.find((p) => p.id === id)!;

/**
 * ホールカード配布のシミュレーション（ボタンの左隣から時計回りで1枚ずつ2周。API契約準拠）。
 * 実装に依存しない独立計算で期待値を出し、store の出力と突き合わせる。
 */
function computeExpectedHoleCards(
  playerIds: string[],
  buttonId: string,
  shuffledDeck: Card[],
): Record<string, Card[]> {
  const buttonPos = playerIds.indexOf(buttonId);
  const dealOrder = playerIds.map((_, i) => playerIds[(buttonPos + 1 + i) % playerIds.length]);
  const hole: Record<string, Card[]> = Object.fromEntries(playerIds.map((id) => [id, [] as Card[]]));
  let idx = 0;
  for (let lap = 0; lap < 2; lap++) {
    for (const id of dealOrder) {
      hole[id].push(shuffledDeck[idx]);
      idx += 1;
    }
  }
  return hole;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('startGame（deck生成+シャッフル→ホールカード配布→postBlinds、SPEC 3.3/4.1）', () => {
  it('2人分のPlayerが正しいchips/seatIndexで生成され、重複しないホールカードが配られ、SB/BBがポストされてpreflopになる', () => {
    useGameStore.getState().startGame(['Alice', 'Bob'], undefined, makeRandom(42));
    const s = useGameStore.getState();

    expect(s.players).toHaveLength(2);
    expect(s.players[0]).toMatchObject({ id: 'player-0', seatIndex: 0, name: 'Alice' });
    expect(s.players[1]).toMatchObject({ id: 'player-1', seatIndex: 1, name: 'Bob' });
    expect(s.dealerButtonPlayerId).toBe('player-0');
    expect(s.phase).toBe('preflop');

    // 決定的な乱数から期待されるシャッフル結果・配布結果を独立に計算して照合する（実装をなぞらない）
    const expectedShuffled = shuffleDeck(createDeck(), makeRandom(42));
    const expectedHole = computeExpectedHoleCards(
      ['player-0', 'player-1'],
      'player-0',
      expectedShuffled,
    );
    expect(s.players[0].cards).toEqual(expectedHole['player-0']);
    expect(s.players[1].cards).toEqual(expectedHole['player-1']);
    expect(s.deck).toEqual(expectedShuffled.slice(4));

    // 52枚・重複なし
    const allCards = [...s.players[0].cards, ...s.players[1].cards, ...s.deck];
    expect(allCards).toHaveLength(52);
    expect(new Set(allCards).size).toBe(52);

    // ヘッズアップ: ボタン=SB。config はデフォルト（SB10/BB20/chips1000）
    expect(player(s, 'player-0').chips).toBe(1000 - 10);
    expect(player(s, 'player-0').currentBet).toBe(10);
    expect(player(s, 'player-1').chips).toBe(1000 - 20);
    expect(player(s, 'player-1').currentBet).toBe(20);
    expect(s.betting.actingOrder).toEqual(['player-0', 'player-1']);
  });

  it('configOverrides をデフォルトにマージする', () => {
    useGameStore.getState().startGame(['Alice', 'Bob'], { startingChips: 500 }, makeRandom(1));
    const s = useGameStore.getState();
    expect(s.config.startingChips).toBe(500);
    expect(s.config.smallBlind).toBe(10); // 上書きしていない値はデフォルトのまま
    expect(s.config.bigBlind).toBe(20);
    expect(player(s, 'player-0').chips).toBe(500 - 10);
  });
});

describe('submitAction: bet/callでshowdownまで進行しchipsに正しく反映される（SPEC 4.4/4.5）', () => {
  it('preflop〜riverをbet/call/checkで進めるとshowdown→handCompleteになり、勝者chipsが増え敗者chipsが減る', () => {
    useGameStore.setState(buildHeadsUpPreflop());

    useGameStore.getState().submitAction({ playerId: 'sb', type: 'call' });
    useGameStore.getState().submitAction({ playerId: 'bb', type: 'check' }); // -> flop
    useGameStore.getState().submitAction({ playerId: 'bb', type: 'bet', amount: 40 });
    useGameStore.getState().submitAction({ playerId: 'sb', type: 'call' }); // -> turn
    useGameStore.getState().submitAction({ playerId: 'bb', type: 'check' });
    useGameStore.getState().submitAction({ playerId: 'sb', type: 'check' }); // -> river
    useGameStore.getState().submitAction({ playerId: 'bb', type: 'bet', amount: 100 });
    useGameStore.getState().submitAction({ playerId: 'sb', type: 'call' }); // -> showdown -> handComplete

    const s = useGameStore.getState();
    expect(s.phase).toBe('handComplete');
    expect(s.communityCards).toEqual(BOARD);
    // sb: SA/DA + ボードの HA でスリーカード。bb: H3/D4 はハイカードのみ → sb が総取り
    expect(player(s, 'sb').chips).toBe(1160); // 1000 - 160(拠出) + 320(獲得)
    expect(player(s, 'bb').chips).toBe(840); // 1000 - 160(拠出、敗北)
    expect(player(s, 'sb').chips + player(s, 'bb').chips).toBe(2000); // チップ保存則
  });
});

describe('fold勝ち: showdownを経ずhandCompleteとなり、勝者が全ポットを獲得する（STATE_MACHINE 3）', () => {
  it('foldしていない側が拠出済みの全チップ(自分の分含む)を獲得する。手札は公開されない', () => {
    useGameStore.setState(buildHeadsUpPreflop());
    useGameStore.getState().submitAction({ playerId: 'sb', type: 'fold' });

    const s = useGameStore.getState();
    expect(s.phase).toBe('handComplete');
    expect(s.communityCards).toHaveLength(0); // showdownを経ない = カードは公開されない
    expect(player(s, 'sb').status).toBe('folded');
    expect(player(s, 'sb').chips).toBe(990); // SB10のみ拠出、fold後は変わらず
    expect(player(s, 'bb').chips).toBe(1010); // 自分のBB20 + 相手SB10の合計30を獲得
    expect(player(s, 'sb').chips + player(s, 'bb').chips).toBe(2000);
  });
});

describe('busted/gameOver: 敗者chipsが0になったらbusted、2人残り1人ならgameOver（SPEC 2/4.6）', () => {
  it('all-inのshowdownで敗者chipsが0になりbustedになる。2人ならgameOverになりstartNextHandはエラーになる', () => {
    useGameStore.setState(buildHeadsUpPreflop());
    useGameStore.getState().submitAction({ playerId: 'sb', type: 'allIn' });
    useGameStore.getState().submitAction({ playerId: 'bb', type: 'allIn' });

    const s = useGameStore.getState();
    expect(player(s, 'sb').chips).toBe(2000);
    expect(player(s, 'bb').chips).toBe(0);
    expect(player(s, 'bb').status).toBe('busted');
    expect(s.phase).toBe('gameOver');

    expect(() => useGameStore.getState().startNextHand()).toThrow();
  });
});

describe('startNextHand: バーストなしでハンドをリセットし、ボタン移動・handNumber+1・preflopへ戻る（SPEC 4.6）', () => {
  it('SPEC 4.6のリセットが行われ、foldしていた側もactiveに戻る', () => {
    useGameStore.setState(buildHeadsUpPreflop());
    useGameStore.getState().submitAction({ playerId: 'sb', type: 'fold' }); // handComplete、bustedなし

    const before = useGameStore.getState();
    expect(before.phase).toBe('handComplete');

    useGameStore.getState().startNextHand(makeRandom(7));

    const s = useGameStore.getState();
    expect(s.phase).toBe('preflop');
    expect(s.handNumber).toBe(before.handNumber + 1);
    expect(s.dealerButtonPlayerId).toBe('bb'); // sb(seat0) の次の非busted着席者 = bb(seat1)
    expect(s.communityCards).toHaveLength(0);
    expect(s.pots).toEqual([]);
    expect(s.deck).toHaveLength(52 - 4);

    for (const p of s.players) {
      expect(p.status).toBe('active'); // foldしていた側もactiveに戻る
      expect(p.cards).toHaveLength(2);
      expect(p.totalContribution).toBe(p.currentBet); // このハンドではブラインドのみ拠出
    }
    // 重複のないカード配布であること
    const allCards = [...s.players[0].cards, ...s.players[1].cards, ...s.deck];
    expect(new Set(allCards).size).toBe(52);
  });
});

describe('リグレッション: ブラインドのポストだけで両者all-inになる端ケースはデッドロックせず自動解決される（STATE_MACHINE 3, gameStore.ts startHand）', () => {
  it('SBに配られるプレイヤーのchipsがsmallBlind未満・BBに配られるプレイヤーのchipsがbigBlind未満のとき、submitActionを一度も呼ばずにhandComplete/gameOverまで進み、5枚のコミュニティが公開され、activePlayerIdはnullのまま、チップ保存則が保たれる', () => {
    // 前提: 現在のボタンはp0(seat0)。startNextHandでボタンはp1(seat1)へ移動し(ヘッズアップの交互移動)、
    // postBlinds のヘッズアップ規則(ボタン=SB)により、次ハンドは p1がSB(chips=5<SB10)・p0がBB(chips=15<BB20)になる。
    // 両者ともブラインド拠出だけでchipsを使い切りall-inとなり、applyActionが一度も呼ばれないまま
    // shouldAutoRunOut===trueに到達する（バグ修正前は誰も行動できずpreflopでデッドロックしていた）。
    const priorHand: GameState = {
      ...makeState([makePlayer('p0', 0, 15, []), makePlayer('p1', 1, 5, [])], 'p0'),
      phase: 'handComplete',
    };
    useGameStore.setState(priorHand);

    useGameStore.getState().startNextHand(makeRandom(3));

    const s = useGameStore.getState();

    // デッドロックしていないこと: submitActionを一度も呼んでいないのに preflop/postingBlinds で止まっていない
    expect(s.phase).not.toBe('preflop');
    expect(s.phase).not.toBe('postingBlinds');
    expect(['handComplete', 'gameOver']).toContain(s.phase);
    expect(s.activePlayerId).toBeNull();
    expect(s.communityCards).toHaveLength(5);
    expect(s.dealerButtonPlayerId).toBe('p1');

    // ボード・ホールカードは shuffleDeck の実出力から独立に計算し、実装の出力と突き合わせる(実装をなぞらない)
    const expectedShuffled = shuffleDeck(createDeck(), makeRandom(3));
    const expectedHole = computeExpectedHoleCards(['p0', 'p1'], 'p1', expectedShuffled);
    expect(player(s, 'p0').cards).toEqual(expectedHole['p0']);
    expect(player(s, 'p1').cards).toEqual(expectedHole['p1']);
    const expectedCommunity = expectedShuffled.slice(4, 9);
    expect(s.communityCards).toEqual(expectedCommunity);

    // 期待されるポット・payoutsは、postBlindsが行うはずの拠出(p1: SB=5, p0: BB=15、共にall-in)から
    // buildPots/distributePots(いずれもPhase6で監査済みのcore関数)の実出力として独立に算出する
    const allInPlayers: Player[] = [
      { ...makePlayer('p0', 0, 0, expectedHole['p0']), status: 'allIn', currentBet: 15, totalContribution: 15 },
      { ...makePlayer('p1', 1, 0, expectedHole['p1']), status: 'allIn', currentBet: 5, totalContribution: 5 },
    ];
    const results = allInPlayers.map((p) => evaluateHand(p.id, p.cards, expectedCommunity));
    const expectedPots = buildPots(allInPlayers);
    const expectedPayouts = distributePots(expectedPots, results, allInPlayers, 'p1');

    expect(s.pots).toEqual(expectedPots);
    expect(player(s, 'p0').chips).toBe(expectedPayouts['p0'] ?? 0);
    expect(player(s, 'p1').chips).toBe(expectedPayouts['p1'] ?? 0);

    // チップ保存則: このハンド開始前の合計(15+5=20)が保たれる
    expect(player(s, 'p0').chips + player(s, 'p1').chips).toBe(20);

    // このシード(3)は p0 が main pot を制する固定値のため、p1 は 0 になり busted・gameOver で終わる
    expect(player(s, 'p1').chips).toBe(0);
    expect(player(s, 'p1').status).toBe('busted');
    expect(player(s, 'p0').status).toBe('allIn');
    expect(s.phase).toBe('gameOver');
  });
});

describe('リグレッション: 片方だけがブラインドall-inのとき、生存プレイヤーの手番を奪って自動進行しない（SPEC 4.2 / レビューC-1）', () => {
  it('BB側がブラインドでall-in・SB側がactiveのとき、preflopでSBの手番になり、SBのコール後に自動進行する', () => {
    // 前提: 現ボタンp1 → startNextHandでボタンはp0へ。ヘッズアップ規則(ボタン=SB)により
    // p0がSB(chips=1985、ポスト後もactive)・p1がBB(chips=15 < BB20 → ブラインドだけでall-in)
    const priorHand: GameState = {
      ...makeState([makePlayer('p0', 0, 1985, []), makePlayer('p1', 1, 15, [])], 'p1'),
      phase: 'handComplete',
    };
    useGameStore.setState(priorHand);

    useGameStore.getState().startNextHand(makeRandom(5));

    const s = useGameStore.getState();
    expect(s.dealerButtonPlayerId).toBe('p0');
    expect(player(s, 'p1').status).toBe('allIn');
    expect(player(s, 'p1').currentBet).toBe(15);
    // ここが本体: activeなSBが残っている限り、勝手にshowdownへ進まずSBの手番で止まる
    expect(s.phase).toBe('preflop');
    expect(s.activePlayerId).toBe('p0');
    expect(s.communityCards).toHaveLength(0);

    // SBがコールすればラウンド完了 → 残りコミュニティ自動公開 → showdown解決まで進む
    useGameStore.getState().submitAction({ playerId: 'p0', type: 'call' });
    const after = useGameStore.getState();
    expect(['handComplete', 'gameOver']).toContain(after.phase);
    expect(after.communityCards).toHaveLength(5);
    // チップ保存則(開始時合計 1985 + 15 = 2000)
    expect(player(after, 'p0').chips + player(after, 'p1').chips).toBe(2000);
  });
});

describe('selectHandCompleteView: fold勝ちを showdown と誤認して手札を公開しない（leak-auditor C-1）', () => {
  it('busted傍観者(前ハンドまでに退場・拠出0)がいるfold勝ちで isShowdown=false・cards=null', () => {
    // 3人卓: w が fold勝ち(拠出30) / f は folded(拠出20) / x は前ハンドまでに busted(拠出0・手札なし)
    const winner: Player = { ...makePlayer('w', 0, 1010, ['SA', 'DA']), totalContribution: 30 };
    const folded: Player = {
      ...makePlayer('f', 1, 980, ['H3', 'D4']),
      status: 'folded',
      totalContribution: 20,
    };
    const busted: Player = { ...makePlayer('x', 2, 0, []), status: 'busted' };
    const s: GameState = { ...makeState([winner, folded, busted], 'w'), phase: 'handComplete' };

    const view = selectHandCompleteView(s);
    expect(view.isShowdown).toBe(false);
    expect(view.entries).toHaveLength(1);
    expect(view.entries[0]).toMatchObject({ playerId: 'w', amount: 50, cards: null, handRank: null });
  });

  it('showdown(このハンドで busted になった敗者を含む)では参加者全員の手札と役が返る', () => {
    // finalizeHandComplete 後の状態を模す: 敗者は busted だが当ハンドの拠出と手札を持つ
    const winner: Player = {
      ...makePlayer('w', 0, 2000, ['SA', 'DA']),
      status: 'allIn',
      totalContribution: 1000,
    };
    const loser: Player = {
      ...makePlayer('l', 1, 0, ['H3', 'D4']),
      status: 'busted',
      totalContribution: 1000,
    };
    const s: GameState = {
      ...makeState([winner, loser], 'w'),
      phase: 'handComplete',
      communityCards: BOARD,
    };

    const view = selectHandCompleteView(s);
    expect(view.isShowdown).toBe(true);
    expect(view.entries).toHaveLength(2);
    const w = view.entries.find((e) => e.playerId === 'w')!;
    const l = view.entries.find((e) => e.playerId === 'l')!;
    expect(w.amount).toBe(2000);
    expect(w.handRank).toBe('threeOfAKind');
    expect(w.cards).toEqual(['SA', 'DA']);
    expect(l.amount).toBe(0);
    expect(l.cards).toEqual(['H3', 'D4']);
  });
});

describe('persist: reveal相当のhandoff・actionLog・timer.remainingSecを保存しない（SPEC 5・CLAUDE.md手札漏洩防止）', () => {
  function persistKey(): string {
    const name = useGameStore.persist.getOptions().name;
    if (!name) throw new Error('persist name が設定されていない');
    return name;
  }

  function readPersistedState(): Record<string, unknown> {
    const raw = window.localStorage.getItem(persistKey());
    expect(raw).not.toBeNull();
    return JSON.parse(raw!).state;
  }

  it('handoff.step===revealのときも保存内容にrevealが残らない(未保存 or locked)', () => {
    useGameStore.getState().startGame(['Alice', 'Bob'], undefined, makeRandom(1));
    useGameStore.setState({
      handoff: {
        step: 'reveal',
        targetPlayerId: 'player-0',
        currentViewerPlayerId: 'player-0',
        pinAttempts: 0,
      },
    });

    const persisted = readPersistedState();
    const handoff = persisted.handoff as { step?: string } | undefined;
    if (handoff !== undefined) {
      expect(handoff.step).not.toBe('reveal');
    }
  });

  it('actionLogを保存しない', () => {
    useGameStore.getState().startGame(['Alice', 'Bob'], undefined, makeRandom(1));
    const persisted = readPersistedState();
    expect(persisted.actionLog).toBeUndefined();
  });

  it('timer.remainingSecを保存しない', () => {
    useGameStore.getState().startGame(['Alice', 'Bob'], undefined, makeRandom(1));
    useGameStore.setState({
      timer: {
        enabled: true,
        durationSec: 30,
        remainingSec: 12,
        timeoutAction: 'autoCheckOrFold',
        isPaused: false,
      },
    });

    const persisted = readPersistedState();
    const timer = persisted.timer as { remainingSec?: number } | undefined;
    if (timer !== undefined) {
      expect(timer.remainingSec).toBeUndefined();
    }
  });

  it('復元(rehydrate)時にhandoff.stepがlockedに強制され、timer.isPausedがtrueになる', async () => {
    useGameStore.getState().startGame(['Alice', 'Bob'], undefined, makeRandom(1));
    useGameStore.setState({
      handoff: {
        step: 'reveal',
        targetPlayerId: 'player-0',
        currentViewerPlayerId: 'player-0',
        pinAttempts: 0,
      },
      timer: {
        enabled: true,
        durationSec: 30,
        remainingSec: 15,
        timeoutAction: 'autoCheckOrFold',
        isPaused: false,
      },
    });

    await useGameStore.persist.rehydrate();

    const s = useGameStore.getState();
    expect(s.handoff.step).toBe('locked');
    expect(s.timer.isPaused).toBe(true);
  });
});
