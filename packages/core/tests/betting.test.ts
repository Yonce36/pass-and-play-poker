// Phase 5: betting engine のテスト（SPEC 3.5 / 4.1–4.3 / 7、STATE_MACHINE 2・3 準拠、テスト先行）
import { describe, expect, it } from 'vitest';
import {
  applyAction,
  buildActingOrder,
  getNextActorPlayerId,
  isRoundComplete,
  postBlinds,
  shouldAutoRunOut,
} from '../src/betting';
import { createDeck } from '../src/deck';
import type { GameConfig, GameState, Player } from '../src/types';

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

function makePlayer(id: string, seatIndex: number, chips = 1000): Player {
  return {
    id,
    seatIndex,
    name: id,
    pin: null,
    chips,
    currentBet: 0,
    totalContribution: 0,
    cards: [],
    status: 'active',
    hasActedThisRound: false,
    hasOption: false,
  };
}

function makeState(players: Player[], dealerButtonPlayerId: string): GameState {
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
    deck: createDeck(),
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

/** ヘッズアップ: sb(=ボタン) / bb の2人でブラインドポスト済み状態を作る */
function headsUpPreflop(): GameState {
  const state = makeState([makePlayer('sb', 0), makePlayer('bb', 1)], 'sb');
  return postBlinds(state);
}

const player = (s: GameState, id: string) => s.players.find((p) => p.id === id)!;

describe('buildActingOrder（SPEC 3.5）', () => {
  const hu = [makePlayer('btn', 0), makePlayer('bb', 1)];
  const three = [makePlayer('btn', 0), makePlayer('sb', 1), makePlayer('bb', 2)];

  it('ヘッズアップ preflop は SB(=ボタン) から', () => {
    expect(buildActingOrder(hu, 'btn', 'preflop')).toEqual(['btn', 'bb']);
  });

  it('ヘッズアップ postflop は BB から', () => {
    expect(buildActingOrder(hu, 'btn', 'flop')).toEqual(['bb', 'btn']);
  });

  it('3人 preflop は BB の左隣（UTG=ボタン）から', () => {
    expect(buildActingOrder(three, 'btn', 'preflop')).toEqual(['btn', 'sb', 'bb']);
  });

  it('3人 postflop はボタンの左隣（SB）から', () => {
    expect(buildActingOrder(three, 'btn', 'turn')).toEqual(['sb', 'bb', 'btn']);
  });

  it('busted はオーダーに含まれない', () => {
    const withBusted = [
      makePlayer('btn', 0),
      { ...makePlayer('sb', 1), status: 'busted' as const },
      makePlayer('bb', 2),
    ];
    expect(buildActingOrder(withBusted, 'btn', 'flop')).toEqual(['bb', 'btn']);
  });
});

describe('postBlinds（SPEC 4.1 / STATE_MACHINE 1）', () => {
  it('ヘッズアップ: ボタンがSB、相手がBBをポストし preflop へ', () => {
    const s = headsUpPreflop();
    expect(s.phase).toBe('preflop');
    expect(player(s, 'sb').chips).toBe(990);
    expect(player(s, 'sb').currentBet).toBe(10);
    expect(player(s, 'sb').totalContribution).toBe(10);
    expect(player(s, 'bb').chips).toBe(980);
    expect(player(s, 'bb').currentBet).toBe(20);
    expect(s.betting.currentMaxBet).toBe(20);
    expect(s.betting.minRaiseTo).toBe(40);
  });

  it('ブラインドはアクションに数えない（hasActedThisRound=false）、BBのみ hasOption=true', () => {
    const s = headsUpPreflop();
    expect(player(s, 'sb').hasActedThisRound).toBe(false);
    expect(player(s, 'bb').hasActedThisRound).toBe(false);
    expect(player(s, 'sb').hasOption).toBe(false);
    expect(player(s, 'bb').hasOption).toBe(true);
  });

  it('ヘッズアップ preflop の手番は SB(=ボタン) から', () => {
    const s = headsUpPreflop();
    expect(s.activePlayerId).toBe('sb');
    expect(s.betting.actingOrder).toEqual(['sb', 'bb']);
  });

  it('blind が actionLog に2件記録される', () => {
    const s = headsUpPreflop();
    expect(s.actionLog).toHaveLength(2);
    expect(s.actionLog.every((l) => l.action === 'blind')).toBe(true);
  });
});

describe('BBオプション（SPEC 4.2 / STATE_MACHINE 2）', () => {
  it('SB がコールして額が揃ってもラウンドは終わらず BB に手番が回る', () => {
    const s = applyAction(headsUpPreflop(), { playerId: 'sb', type: 'call' });
    expect(s.phase).toBe('preflop');
    expect(s.activePlayerId).toBe('bb');
    expect(player(s, 'bb').hasOption).toBe(true);
    expect(isRoundComplete(s.players, s.betting)).toBe(false);
  });

  it('BB がチェックして初めてラウンド終了 → flop へ', () => {
    let s = applyAction(headsUpPreflop(), { playerId: 'sb', type: 'call' });
    s = applyAction(s, { playerId: 'bb', type: 'check' });
    expect(s.phase).toBe('flop');
    expect(s.communityCards).toHaveLength(3);
  });

  it('BB はオプションでレイズできる', () => {
    let s = applyAction(headsUpPreflop(), { playerId: 'sb', type: 'call' });
    s = applyAction(s, { playerId: 'bb', type: 'raise', amount: 60 });
    expect(s.phase).toBe('preflop');
    expect(s.betting.currentMaxBet).toBe(60);
    expect(s.activePlayerId).toBe('sb');
  });
});

describe('全員チェック / bet-call（SPEC 7）', () => {
  function huFlop(): GameState {
    const s = applyAction(headsUpPreflop(), { playerId: 'sb', type: 'call' });
    return applyAction(s, { playerId: 'bb', type: 'check' });
  }

  it('flop はヘッズアップでは BB から', () => {
    expect(huFlop().activePlayerId).toBe('bb');
  });

  it('全員チェックで次ストリートへ', () => {
    let s = applyAction(huFlop(), { playerId: 'bb', type: 'check' });
    expect(s.phase).toBe('flop');
    s = applyAction(s, { playerId: 'sb', type: 'check' });
    expect(s.phase).toBe('turn');
    expect(s.communityCards).toHaveLength(4);
  });

  it('bet → call で次ストリートへ。チップが正しく動く', () => {
    let s = applyAction(huFlop(), { playerId: 'bb', type: 'bet', amount: 40 });
    expect(s.betting.currentMaxBet).toBe(40);
    expect(s.betting.minRaiseTo).toBe(80);
    s = applyAction(s, { playerId: 'sb', type: 'call' });
    expect(s.phase).toBe('turn');
    expect(player(s, 'bb').chips).toBe(940); // 1000 - 20(BB) - 40
    expect(player(s, 'sb').chips).toBe(940); // 1000 - 20(call) - 40
    expect(player(s, 'bb').totalContribution).toBe(60);
    expect(player(s, 'sb').totalContribution).toBe(60);
  });

  it('BBに満たない bet は不可（all-in を除く）', () => {
    expect(() => applyAction(huFlop(), { playerId: 'bb', type: 'bet', amount: 10 })).toThrow();
  });
});

describe('フルレイズによる義務リセットと minRaiseTo 更新（SPEC 4.2 / 4.3）', () => {
  it('フルレイズでレイザー以外の active の hasActedThisRound=false / hasOption=true', () => {
    let s = applyAction(headsUpPreflop(), { playerId: 'sb', type: 'call' });
    s = applyAction(s, { playerId: 'bb', type: 'check' }); // flop へ
    s = applyAction(s, { playerId: 'bb', type: 'bet', amount: 40 });
    s = applyAction(s, { playerId: 'sb', type: 'raise', amount: 100 });
    expect(player(s, 'bb').hasActedThisRound).toBe(false);
    expect(player(s, 'bb').hasOption).toBe(true);
    expect(player(s, 'sb').hasActedThisRound).toBe(true);
    expect(player(s, 'sb').hasOption).toBe(false);
    // minRaiseTo = 100 + (100-40) = 160
    expect(s.betting.lastFullRaiseAmount).toBe(60);
    expect(s.betting.minRaiseTo).toBe(160);
    expect(s.betting.lastAggressorPlayerId).toBe('sb');
  });

  it('minRaiseTo 未満のレイズは不可（all-in を除く）', () => {
    const s = headsUpPreflop(); // minRaiseTo = 40
    expect(() => applyAction(s, { playerId: 'sb', type: 'raise', amount: 30 })).toThrow();
  });
});

describe('short all-in は reopen しない（SPEC 3.3 / 4.2）', () => {
  /** 3人 flop: a(bet側,1000) / b(ショートスタック150) / c(1000) */
  function threeHandedFlop(): GameState {
    let s = makeState(
      [makePlayer('btn', 0, 1000), makePlayer('sb', 1, 150), makePlayer('bb', 2, 1000)],
      'btn',
    );
    s = postBlinds(s); // preflop: btn から
    s = applyAction(s, { playerId: 'btn', type: 'call' }); // 20
    s = applyAction(s, { playerId: 'sb', type: 'call' }); // +10
    s = applyAction(s, { playerId: 'bb', type: 'check' }); // flop へ。order: sb, bb, btn
    return s;
  }

  it('short all-in 後、既アクション者の義務は立て直されず、レイズもできない', () => {
    let s = threeHandedFlop();
    s = applyAction(s, { playerId: 'sb', type: 'check' });
    s = applyAction(s, { playerId: 'bb', type: 'bet', amount: 100 });
    // sb は残130で all-in（到達額 130 < minRaiseTo 200 → short。sb残チップ = 150 - 20 = 130）
    s = applyAction(s, { playerId: 'btn', type: 'call' });
    s = applyAction(s, { playerId: 'sb', type: 'allIn' }); // 到達額130 < 200 → short
    expect(player(s, 'sb').status).toBe('allIn');
    expect(s.betting.currentMaxBet).toBe(130);
    // reopen されない: bb / btn の hasActedThisRound は true のまま、hasOption は false のまま
    expect(player(s, 'bb').hasActedThisRound).toBe(true);
    expect(player(s, 'bb').hasOption).toBe(false);
    expect(player(s, 'btn').hasActedThisRound).toBe(true);
    expect(player(s, 'btn').hasOption).toBe(false);
    // lastFullRaiseAmount は 100 のまま。minRaiseTo = 130 + 100
    expect(s.betting.lastFullRaiseAmount).toBe(100);
    expect(s.betting.minRaiseTo).toBe(230);
    // ラウンドは未終了（bb/btn の currentBet 100 < 130）→ 差額のコールは必要
    expect(s.phase).toBe('flop');
    expect(s.activePlayerId).toBe('bb');
    // 既アクション者はレイズ不可（コール/フォールドのみ）
    expect(() => applyAction(s, { playerId: 'bb', type: 'raise', amount: 300 })).toThrow();
    // 差額コールで全員が揃うとラウンド終了
    s = applyAction(s, { playerId: 'bb', type: 'call' });
    s = applyAction(s, { playerId: 'btn', type: 'call' });
    expect(s.phase).toBe('turn');
  });

  it('フルレイズ相当の all-in は reopen する', () => {
    let s = threeHandedFlop();
    s = applyAction(s, { playerId: 'sb', type: 'check' });
    s = applyAction(s, { playerId: 'bb', type: 'bet', amount: 50 });
    s = applyAction(s, { playerId: 'btn', type: 'call' });
    s = applyAction(s, { playerId: 'sb', type: 'allIn' }); // 130 >= minRaiseTo 100 → full raise
    expect(player(s, 'bb').hasActedThisRound).toBe(false);
    expect(player(s, 'bb').hasOption).toBe(true);
    expect(s.betting.lastFullRaiseAmount).toBe(80); // 130 - 50
    expect(s.betting.minRaiseTo).toBe(210);
  });
});

describe('fold勝ち（STATE_MACHINE 3）', () => {
  it('ヘッズアップで SB が fold → showdown を経ず handComplete', () => {
    const s = applyAction(headsUpPreflop(), { playerId: 'sb', type: 'fold' });
    expect(s.phase).toBe('handComplete');
    expect(s.activePlayerId).toBeNull();
    expect(player(s, 'sb').status).toBe('folded');
  });

  it('3人で2人が fold → handComplete', () => {
    let s = makeState(
      [makePlayer('btn', 0), makePlayer('sb', 1), makePlayer('bb', 2)],
      'btn',
    );
    s = postBlinds(s);
    s = applyAction(s, { playerId: 'btn', type: 'fold' });
    expect(s.phase).toBe('preflop');
    s = applyAction(s, { playerId: 'sb', type: 'fold' });
    expect(s.phase).toBe('handComplete');
  });
});

describe('全員オールイン自動進行（STATE_MACHINE 3）', () => {
  it('preflop で双方 all-in → 残り5枚を自動公開して showdown へ', () => {
    let s = applyAction(headsUpPreflop(), { playerId: 'sb', type: 'allIn' });
    s = applyAction(s, { playerId: 'bb', type: 'allIn' });
    expect(s.phase).toBe('showdown');
    expect(s.communityCards).toHaveLength(5);
    expect(player(s, 'sb').status).toBe('allIn');
    expect(player(s, 'bb').status).toBe('allIn');
  });

  it('all-in にチップが残る側がコールした場合も自動進行する', () => {
    let s = makeState([makePlayer('sb', 0, 500), makePlayer('bb', 1, 1000)], 'sb');
    s = postBlinds(s);
    s = applyAction(s, { playerId: 'sb', type: 'allIn' }); // 500
    s = applyAction(s, { playerId: 'bb', type: 'call' }); // 残500の active
    expect(s.phase).toBe('showdown');
    expect(s.communityCards).toHaveLength(5);
    expect(player(s, 'bb').status).toBe('active');
    expect(player(s, 'bb').chips).toBe(500);
  });

  it('flop 途中の all-in → コール成立時に turn/river を自動公開', () => {
    let s = applyAction(headsUpPreflop(), { playerId: 'sb', type: 'call' });
    s = applyAction(s, { playerId: 'bb', type: 'check' }); // flop
    s = applyAction(s, { playerId: 'bb', type: 'allIn' });
    expect(s.phase).toBe('flop'); // まだ相手の手番
    s = applyAction(s, { playerId: 'sb', type: 'call' });
    expect(s.phase).toBe('showdown');
    expect(s.communityCards).toHaveLength(5);
  });
});

describe('次ストリートのリセット（SPEC 4.6 / STATE_MACHINE 2）', () => {
  it('street 遷移で currentBet / hasActed / hasOption / betting がリセットされる', () => {
    let s = applyAction(headsUpPreflop(), { playerId: 'sb', type: 'call' });
    s = applyAction(s, { playerId: 'bb', type: 'check' });
    expect(s.phase).toBe('flop');
    for (const p of s.players) {
      expect(p.currentBet).toBe(0);
      expect(p.hasActedThisRound).toBe(false);
      expect(p.hasOption).toBe(false);
    }
    expect(s.betting.currentMaxBet).toBe(0);
    expect(s.betting.minRaiseTo).toBe(20); // 最低ベット = BB
    expect(s.betting.lastAggressorPlayerId).toBeNull();
    expect(s.betting.actingOrder).toEqual(['bb', 'sb']);
    // totalContribution は維持される（サイドポット入力）
    expect(player(s, 'sb').totalContribution).toBe(20);
    // deck からフロップ3枚が引かれている
    expect(s.deck).toHaveLength(52 - 3);
  });
});

describe('不正アクションの拒否', () => {
  it('手番以外のプレイヤーは行動できない', () => {
    expect(() => applyAction(headsUpPreflop(), { playerId: 'bb', type: 'check' })).toThrow();
  });

  it('ベットに直面して check はできない', () => {
    expect(() => applyAction(headsUpPreflop(), { playerId: 'sb', type: 'check' })).toThrow();
  });

  it('NaN・非整数の raise は拒否される', () => {
    expect(() =>
      applyAction(headsUpPreflop(), { playerId: 'sb', type: 'raise', amount: NaN }),
    ).toThrow();
    expect(() =>
      applyAction(headsUpPreflop(), { playerId: 'sb', type: 'raise', amount: 45.5 }),
    ).toThrow();
  });

  it('ベッティングフェーズ以外では行動できない', () => {
    const s = makeState([makePlayer('sb', 0), makePlayer('bb', 1)], 'sb');
    expect(() => applyAction(s, { playerId: 'sb', type: 'check' })).toThrow();
  });
});

describe('純粋性: applyAction は入力 state を変更しない', () => {
  it('入力の深い比較が呼び出し前後で一致する', () => {
    const before = headsUpPreflop();
    const snapshot = JSON.parse(JSON.stringify(before));
    applyAction(before, { playerId: 'sb', type: 'raise', amount: 60 });
    expect(before).toEqual(snapshot);
  });
});

describe('getNextActorPlayerId / shouldAutoRunOut', () => {
  it('folded / allIn はスキップされる', () => {
    const players = [
      { ...makePlayer('a', 0), status: 'folded' as const },
      { ...makePlayer('b', 1), status: 'allIn' as const },
      makePlayer('c', 2),
    ];
    const betting = { ...headsUpPreflop().betting, actingOrder: ['a', 'b', 'c'] };
    expect(getNextActorPlayerId(players, betting, null)).toBe('c');
  });

  it('shouldAutoRunOut: active 1人以下 かつ 非fold 2人以上', () => {
    const allIn2 = [
      { ...makePlayer('a', 0), status: 'allIn' as const },
      { ...makePlayer('b', 1), status: 'allIn' as const },
    ];
    expect(shouldAutoRunOut(allIn2)).toBe(true);
    const oneActive = [{ ...makePlayer('a', 0), status: 'allIn' as const }, makePlayer('b', 1)];
    expect(shouldAutoRunOut(oneActive)).toBe(true);
    const twoActive = [makePlayer('a', 0), makePlayer('b', 1)];
    expect(shouldAutoRunOut(twoActive)).toBe(false);
  });
});
