// betting — ベッティングラウンドのエンジン（pure function）
// SPEC 3.5 / 4.1–4.3、STATE_MACHINE セクション2・3 を正とする
import type {
  ActionType,
  BettingState,
  GamePhase,
  GameState,
  Player,
} from './types';

/** プレイヤーの能動アクション（blind/timeout はエンジン側で発生させる） */
export interface PlayerAction {
  playerId: string;
  type: Extract<ActionType, 'check' | 'call' | 'bet' | 'raise' | 'fold' | 'allIn'>;
  /** bet/raise の到達額（currentBet 換算）。allIn では無視される */
  amount?: number;
}

const BETTING_PHASES: GamePhase[] = ['preflop', 'flop', 'turn', 'river'];

const NEXT_PHASE: Partial<Record<GamePhase, GamePhase>> = {
  preflop: 'flop',
  flop: 'turn',
  turn: 'river',
  river: 'showdown',
};

/** 山札やハンドに参加しうる着席プレイヤーを seatIndex 昇順（時計回り）で返す */
function seatedPlayers(players: Player[]): Player[] {
  return players
    .filter((p) => p.status !== 'busted' && p.status !== 'sittingOut')
    .sort((a, b) => a.seatIndex - b.seatIndex);
}

/**
 * 現ストリートの actingOrder を構築する（SPEC 3.5）。
 * preflop: BBの左隣から時計回り（ヘッズアップは SB=ボタン から）
 * postflop: ボタンの左隣から時計回り（ヘッズアップは BB から）
 * folded / allIn は含まれるが手番取得時にスキップされる。
 */
export function buildActingOrder(
  players: Player[],
  dealerButtonPlayerId: string,
  phase: GamePhase,
): string[] {
  if (!BETTING_PHASES.includes(phase)) {
    throw new Error(`buildActingOrder: not a betting phase: ${phase}`);
  }
  const seated = seatedPlayers(players);
  const buttonPos = seated.findIndex((p) => p.id === dealerButtonPlayerId);
  if (buttonPos === -1) {
    throw new Error(`buildActingOrder: button player not seated: ${dealerButtonPlayerId}`);
  }
  const headsUp = seated.length === 2;
  const startOffset = phase === 'preflop' ? (headsUp ? 0 : 3) : 1;
  return seated.map((_, i) => seated[(buttonPos + startOffset + i) % seated.length].id);
}

/** 次手番の playerId を返す（folded/allIn/busted/sittingOut はスキップ）。手番なしは null */
export function getNextActorPlayerId(
  players: Player[],
  betting: BettingState,
  currentActorPlayerId: string | null,
): string | null {
  const order = betting.actingOrder;
  if (order.length === 0) return null;
  const byId = new Map(players.map((p) => [p.id, p]));
  const start =
    currentActorPlayerId === null ? 0 : order.indexOf(currentActorPlayerId) + 1;
  for (let i = 0; i < order.length; i++) {
    const p = byId.get(order[(start + i) % order.length]);
    if (p && p.status === 'active') return p.id;
  }
  return null;
}

/** ベッティングラウンド終了判定（SPEC 4.2） */
export function isRoundComplete(players: Player[], betting: BettingState): boolean {
  return players
    .filter((p) => p.status === 'active')
    .every(
      (p) =>
        p.hasActedThisRound && !p.hasOption && p.currentBet === betting.currentMaxBet,
    );
}

/** 行動可能な active が1人以下 かつ 2人以上が非fold（全員オールイン自動進行の入口） */
export function shouldAutoRunOut(players: Player[]): boolean {
  const actives = players.filter((p) => p.status === 'active').length;
  const inHand = players.filter(
    (p) => p.status === 'active' || p.status === 'allIn',
  ).length;
  return actives <= 1 && inHand >= 2;
}

/** ブラインドを強制ポストして preflop を開始する（STATE_MACHINE 1）。元の state は変更しない */
export function postBlinds(state: GameState, timestamp = 0): GameState {
  if (state.phase !== 'postingBlinds') {
    throw new Error(`postBlinds: expected postingBlinds, got ${state.phase}`);
  }
  if (state.dealerButtonPlayerId === null) {
    throw new Error('postBlinds: dealerButtonPlayerId is null');
  }
  const players = state.players.map((p) => ({ ...p, cards: [...p.cards] }));
  const seated = seatedPlayers(players);
  const buttonPos = seated.findIndex((p) => p.id === state.dealerButtonPlayerId);
  if (buttonPos === -1) throw new Error('postBlinds: button player not seated');
  const headsUp = seated.length === 2;
  // ヘッズアップはボタンがSB（SPEC 4.1）
  const sb = headsUp ? seated[buttonPos] : seated[(buttonPos + 1) % seated.length];
  const bb = headsUp
    ? seated[(buttonPos + 1) % seated.length]
    : seated[(buttonPos + 2) % seated.length];

  const post = (p: Player, amount: number): number => {
    const paid = Math.min(amount, p.chips);
    p.chips -= paid;
    p.currentBet += paid;
    p.totalContribution += paid;
    if (p.chips === 0) p.status = 'allIn';
    return paid;
  };
  const sbPaid = post(sb, state.config.smallBlind);
  const bbPaid = post(bb, state.config.bigBlind);
  // ブラインドはアクションに数えない。BBのみ再アクション権（SPEC 3.3）
  if (bb.status === 'active') bb.hasOption = true;

  const betting: BettingState = {
    actingOrder: buildActingOrder(players, state.dealerButtonPlayerId, 'preflop'),
    currentMaxBet: state.config.bigBlind,
    minRaiseTo: state.config.bigBlind * 2,
    lastFullRaiseAmount: state.config.bigBlind,
    lastAggressorPlayerId: null,
    firstActorPlayerId: null,
  };
  betting.firstActorPlayerId = getNextActorPlayerId(players, betting, null);

  const makeLog = (p: Player, paid: number, index: number) => ({
    id: `${state.handNumber}-${state.actionLog.length + index}`,
    handNumber: state.handNumber,
    street: 'postingBlinds' as GamePhase,
    playerId: p.id,
    action: 'blind' as ActionType,
    amount: paid,
    resultingBet: p.currentBet,
    timestamp,
  });

  return {
    ...state,
    phase: 'preflop',
    players,
    betting,
    activePlayerId: betting.firstActorPlayerId,
    actionLog: [...state.actionLog, makeLog(sb, sbPaid, 0), makeLog(bb, bbPaid, 1)],
  };
}

/** ストリート終了処理: リセット・カード公開・次フェーズ（全員オールイン時は showdown へ直行） */
function endStreet(state: GameState): GameState {
  const players = state.players.map((p) => ({
    ...p,
    cards: [...p.cards],
    currentBet: 0,
    hasActedThisRound: false,
    hasOption: false,
  }));
  let deck = [...state.deck];
  const communityCards = [...state.communityCards];
  const deal = (n: number): void => {
    communityCards.push(...deck.slice(0, n));
    deck = deck.slice(n);
  };

  let phase: GamePhase;
  if (shouldAutoRunOut(players)) {
    // 残りストリートをベッティングなしで自動公開（STATE_MACHINE 3）
    deal(5 - communityCards.length);
    phase = 'showdown';
  } else {
    phase = NEXT_PHASE[state.phase]!;
    if (phase === 'flop') deal(3);
    else if (phase === 'turn' || phase === 'river') deal(1);
  }

  const base = { ...state, players, deck, communityCards, phase };
  if (phase === 'showdown') {
    return {
      ...base,
      activePlayerId: null,
      betting: {
        ...state.betting,
        actingOrder: [],
        currentMaxBet: 0,
        firstActorPlayerId: null,
      },
    };
  }

  const betting: BettingState = {
    actingOrder: buildActingOrder(players, state.dealerButtonPlayerId!, phase),
    currentMaxBet: 0,
    minRaiseTo: state.config.bigBlind, // 最低ベット = BB
    lastFullRaiseAmount: state.config.bigBlind,
    lastAggressorPlayerId: null,
    firstActorPlayerId: null,
  };
  betting.firstActorPlayerId = getNextActorPlayerId(players, betting, null);
  return { ...base, betting, activePlayerId: betting.firstActorPlayerId };
}

/** アクションを適用した新しい GameState を返す（元の state は変更しない） */
export function applyAction(
  state: GameState,
  action: PlayerAction,
  timestamp = 0,
): GameState {
  if (!BETTING_PHASES.includes(state.phase)) {
    throw new Error(`applyAction: not a betting phase: ${state.phase}`);
  }
  if (action.playerId !== state.activePlayerId) {
    throw new Error(`applyAction: not ${action.playerId}'s turn`);
  }

  const players = state.players.map((p) => ({ ...p, cards: [...p.cards] }));
  const betting: BettingState = {
    ...state.betting,
    actingOrder: [...state.betting.actingOrder],
  };
  const me = players.find((p) => p.id === action.playerId);
  if (!me || me.status !== 'active') {
    throw new Error(`applyAction: player cannot act: ${action.playerId}`);
  }

  const pay = (amount: number): void => {
    me.chips -= amount;
    me.currentBet += amount;
    me.totalContribution += amount;
  };
  /** フルレイズ成立: レイザー以外の active 全員の義務を立て直す（SPEC 4.2） */
  const reopenOthers = (): void => {
    for (const p of players) {
      if (p.id !== me.id && p.status === 'active') {
        p.hasActedThisRound = false;
        p.hasOption = true;
      }
    }
  };

  // allIn は額に応じて call / bet / raise 扱い（STATE_MACHINE 2）
  let type: PlayerAction['type'] = action.type;
  let amount = action.amount;
  if (type === 'allIn') {
    if (me.chips === 0) throw new Error('applyAction: no chips to go all-in');
    amount = me.currentBet + me.chips;
    if (betting.currentMaxBet === 0) type = 'bet';
    else if (amount > betting.currentMaxBet) type = 'raise';
    else type = 'call';
  }

  let paid = 0;
  switch (type) {
    case 'fold':
      me.status = 'folded';
      break;
    case 'check':
      if (me.currentBet !== betting.currentMaxBet) {
        throw new Error('applyAction: cannot check facing a bet');
      }
      break;
    case 'call': {
      const toCall = betting.currentMaxBet - me.currentBet;
      if (toCall <= 0) throw new Error('applyAction: nothing to call');
      paid = Math.min(toCall, me.chips);
      pay(paid);
      break;
    }
    case 'bet': {
      if (betting.currentMaxBet !== 0) throw new Error('applyAction: use raise, not bet');
      if (amount === undefined || !Number.isInteger(amount) || amount <= 0) {
        throw new Error('applyAction: bet amount must be a positive integer');
      }
      paid = amount - me.currentBet;
      if (paid <= 0 || paid > me.chips) throw new Error('applyAction: invalid bet amount');
      const isAllIn = paid === me.chips;
      if (amount < betting.minRaiseTo && !isAllIn) {
        throw new Error('applyAction: bet below minimum');
      }
      pay(paid);
      if (amount >= betting.minRaiseTo) {
        // フルベット: レイズ増分はベット額そのもの
        betting.currentMaxBet = amount;
        betting.lastFullRaiseAmount = amount;
        betting.minRaiseTo = amount + amount;
        betting.lastAggressorPlayerId = me.id;
        reopenOthers();
      } else {
        // short all-in bet: reopen しない（SPEC 4.2）
        betting.currentMaxBet = amount;
        betting.minRaiseTo = amount + betting.lastFullRaiseAmount;
      }
      break;
    }
    case 'raise': {
      if (betting.currentMaxBet === 0) throw new Error('applyAction: use bet, not raise');
      if (amount === undefined || !Number.isInteger(amount) || amount <= 0) {
        throw new Error('applyAction: raise amount must be a positive integer');
      }
      // short all-in 後の既アクション者はレイズ権がない（reopen されていない）
      if (me.hasActedThisRound && !me.hasOption) {
        throw new Error('applyAction: raising not reopened for this player');
      }
      if (amount <= betting.currentMaxBet) {
        throw new Error('applyAction: raise must exceed current max bet');
      }
      paid = amount - me.currentBet;
      if (paid <= 0 || paid > me.chips) throw new Error('applyAction: invalid raise amount');
      const isAllIn = paid === me.chips;
      const isFullRaise = amount >= betting.minRaiseTo;
      if (!isFullRaise && !isAllIn) throw new Error('applyAction: raise below minimum');
      pay(paid);
      if (isFullRaise) {
        betting.lastFullRaiseAmount = amount - betting.currentMaxBet;
        betting.currentMaxBet = amount;
        betting.minRaiseTo = amount + betting.lastFullRaiseAmount;
        betting.lastAggressorPlayerId = me.id;
        reopenOthers();
      } else {
        // short all-in raise: reopen しない（SPEC 4.2）
        betting.currentMaxBet = amount;
        betting.minRaiseTo = amount + betting.lastFullRaiseAmount;
      }
      break;
    }
  }

  me.hasActedThisRound = true;
  me.hasOption = false;
  if (me.chips === 0 && me.status === 'active') me.status = 'allIn';

  const logEntry = {
    id: `${state.handNumber}-${state.actionLog.length}`,
    handNumber: state.handNumber,
    street: state.phase,
    playerId: me.id,
    action: (me.status === 'allIn' ? 'allIn' : action.type) as ActionType,
    amount: paid,
    resultingBet: me.currentBet,
    timestamp,
  };

  const next: GameState = {
    ...state,
    players,
    betting,
    actionLog: [...state.actionLog, logEntry],
  };

  // fold勝ち: 非foldが1人になった瞬間、showdown を経ず handComplete（STATE_MACHINE 3）
  const inHand = players.filter((p) => p.status === 'active' || p.status === 'allIn');
  if (inHand.length === 1) {
    return { ...next, phase: 'handComplete', activePlayerId: null };
  }
  if (isRoundComplete(players, betting)) {
    return endStreet(next);
  }
  return { ...next, activePlayerId: getNextActorPlayerId(players, betting, me.id) };
}
