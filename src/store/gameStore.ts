// gameStore — Zustand store。core関数(deck/betting/sidePot/showdown/handEval)を
// action から呼ぶ一方向構成。乱数・時刻はここで注入する（SPEC 3〜5、STATE_MACHINE 1・3 準拠）
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { applyAction, postBlinds, type PlayerAction } from '@/core/betting';
import { createDeck, shuffleDeck } from '@/core/deck';
import { evaluateHand } from '@/core/handEval';
import { distributePots, type Payouts } from '@/core/showdown';
import { buildPots } from '@/core/sidePot';
import type { BettingState, Card, GameConfig, GameState, HandResult, Player } from '@/types';

const DEFAULT_CONFIG: GameConfig = {
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

const EMPTY_BETTING: BettingState = {
  actingOrder: [],
  currentMaxBet: 0,
  minRaiseTo: 0,
  lastFullRaiseAmount: 0,
  lastAggressorPlayerId: null,
  firstActorPlayerId: null,
};

/** ボタンの左隣から時計回りで1枚ずつ2周、ホールカードを配る */
function dealHoleCards(
  players: Player[],
  dealerButtonPlayerId: string,
  deck: Card[],
): { players: Player[]; deck: Card[] } {
  const seated = players
    .filter((p) => p.status !== 'busted' && p.status !== 'sittingOut')
    .sort((a, b) => a.seatIndex - b.seatIndex);
  const buttonPos = seated.findIndex((p) => p.id === dealerButtonPlayerId);
  if (buttonPos === -1) throw new Error('dealHoleCards: button player not seated');

  const dealOrder = seated.map((_, i) => seated[(buttonPos + 1 + i) % seated.length]);
  const holeCards = new Map<string, Card[]>(dealOrder.map((p) => [p.id, []]));
  let remaining = deck;
  for (let lap = 0; lap < 2; lap++) {
    for (const p of dealOrder) {
      holeCards.get(p.id)!.push(remaining[0]);
      remaining = remaining.slice(1);
    }
  }
  return {
    players: players.map((p) => (holeCards.has(p.id) ? { ...p, cards: holeCards.get(p.id)! } : p)),
    deck: remaining,
  };
}

/**
 * 山札生成+シャッフル→ホールカード配布→ブラインドポストを行い preflop へ進める。
 * ブラインド拠出だけで全員 all-in になる端ケース(rules-auditor指摘)は、
 * 誰も行動できずデッドロックするため、その場で残りコミュニティカードを自動公開して showdown を解決する。
 * 判定は「行動できる手番が存在しない」こと(activePlayerId===null)で行う。
 * active が1人でも残っていればその手番(コール/フォールド等)を奪ってはならないため、
 * ここで shouldAutoRunOut は使わない(ラウンド終了時専用の条件。core の endStreet が扱う)。
 */
function startHand(state: GameState, random: () => number, timestamp: number): GameState {
  if (!state.dealerButtonPlayerId) throw new Error('startHand: dealerButtonPlayerId is null');
  const shuffled = shuffleDeck(createDeck(), random);
  const { players, deck } = dealHoleCards(state.players, state.dealerButtonPlayerId, shuffled);
  const afterBlinds = postBlinds({ ...state, players, deck, phase: 'postingBlinds' }, timestamp);
  if (afterBlinds.activePlayerId !== null) return afterBlinds;
  return finalizeHandComplete(resolveShowdown(dealRemainingCommunityCards(afterBlinds)));
}

/** 残りのコミュニティカードをすべて公開し showdown へ直行する（STATE_MACHINE 3: 全員オールイン） */
function dealRemainingCommunityCards(state: GameState): GameState {
  const need = 5 - state.communityCards.length;
  return {
    ...state,
    communityCards: [...state.communityCards, ...state.deck.slice(0, need)],
    deck: state.deck.slice(need),
    phase: 'showdown',
    activePlayerId: null,
    betting: { ...state.betting, actingOrder: [], currentMaxBet: 0, firstActorPlayerId: null },
  };
}

/** ボタンをbusted/sittingOutでない次の着席者(seatIndex昇順の時計回り)へ移動する */
function nextButtonPlayerId(players: Player[], currentButtonId: string): string {
  const bySeat = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const currentIdx = bySeat.findIndex((p) => p.id === currentButtonId);
  if (currentIdx === -1) throw new Error('nextButtonPlayerId: current button not seated');
  for (let i = 1; i <= bySeat.length; i++) {
    const candidate = bySeat[(currentIdx + i) % bySeat.length];
    if (candidate.status !== 'busted' && candidate.status !== 'sittingOut') return candidate.id;
  }
  throw new Error('nextButtonPlayerId: no eligible player found');
}

/** SPEC 4.6: 次ハンドに向けてプレイヤー状態をリセットする（busted/sittingOutは維持） */
function resetPlayersForNextHand(players: Player[]): Player[] {
  return players.map(
    (p): Player => ({
      ...p,
      currentBet: 0,
      totalContribution: 0,
      hasActedThisRound: false,
      hasOption: false,
      cards: [],
      status: p.status === 'busted' || p.status === 'sittingOut' ? p.status : 'active',
    }),
  );
}

function applyPayouts(state: GameState, payouts: Payouts): GameState {
  return {
    ...state,
    players: state.players.map((p) => (payouts[p.id] ? { ...p, chips: p.chips + payouts[p.id] } : p)),
  };
}

/** showdown到達時: 非fold全員を評価しポット分配（SPEC 4.4/4.5） */
function resolveShowdown(state: GameState): GameState {
  const inHand = state.players.filter((p) => p.status === 'active' || p.status === 'allIn');
  const results: HandResult[] = inHand.map((p) => evaluateHand(p.id, p.cards, state.communityCards));
  const pots = buildPots(state.players);
  const payouts = distributePots(pots, results, state.players, state.dealerButtonPlayerId!);
  return applyPayouts({ ...state, pots, phase: 'handComplete' }, payouts);
}

/** fold勝ち: showdownを経ず唯一の残存者が全ポットを獲得（手札公開なし。STATE_MACHINE 3） */
function resolveFoldWin(state: GameState): GameState {
  const winner = state.players.find((p) => p.status === 'active' || p.status === 'allIn');
  if (!winner) throw new Error('resolveFoldWin: no winner found');
  const pots = buildPots(state.players);
  const total = pots.reduce((sum, pot) => sum + pot.amount, 0);
  return applyPayouts({ ...state, pots }, { [winner.id]: total });
}

/** handComplete到達直後: busted判定→残り1人ならgameOver（SPEC 4.6） */
function finalizeHandComplete(state: GameState): GameState {
  const players = state.players.map(
    (p): Player => (p.chips === 0 && p.status !== 'busted' ? { ...p, status: 'busted' } : p),
  );
  const remaining = players.filter((p) => p.status !== 'busted' && p.status !== 'sittingOut');
  return { ...state, players, phase: remaining.length <= 1 ? 'gameOver' : 'handComplete' };
}

interface GameStore extends GameState {
  startGame: (playerNames: string[], configOverrides?: Partial<GameConfig>, random?: () => number) => void;
  submitAction: (action: PlayerAction, timestamp?: number) => void;
  startNextHand: (random?: () => number, timestamp?: number) => void;
}

type PersistedGameState = Pick<
  GameState,
  | 'handNumber'
  | 'phase'
  | 'config'
  | 'players'
  | 'activePlayerId'
  | 'dealerButtonPlayerId'
  | 'betting'
  | 'pots'
  | 'communityCards'
  | 'deck'
>;

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      handNumber: 0,
      phase: 'setup',
      config: DEFAULT_CONFIG,
      players: [],
      activePlayerId: null,
      dealerButtonPlayerId: null,
      betting: EMPTY_BETTING,
      pots: [],
      communityCards: [],
      deck: [],
      handoff: { step: 'locked', targetPlayerId: null, currentViewerPlayerId: null, pinAttempts: 0 },
      timer: {
        enabled: false,
        durationSec: 30,
        remainingSec: 30,
        timeoutAction: 'autoCheckOrFold',
        isPaused: true,
      },
      actionLog: [],

      startGame: (playerNames, configOverrides, random = Math.random) => {
        set(() => {
          const config: GameConfig = { ...DEFAULT_CONFIG, ...configOverrides };
          const players: Player[] = playerNames.map((name, i) => ({
            id: `player-${i}`,
            seatIndex: i,
            name,
            pin: null,
            chips: config.startingChips,
            currentBet: 0,
            totalContribution: 0,
            cards: [],
            status: 'active',
            hasActedThisRound: false,
            hasOption: false,
          }));
          const fresh: GameState = {
            handNumber: 1,
            phase: 'postingBlinds',
            config,
            players,
            activePlayerId: null,
            dealerButtonPlayerId: players[0].id,
            betting: EMPTY_BETTING,
            pots: [],
            communityCards: [],
            deck: createDeck(),
            handoff: { step: 'locked', targetPlayerId: null, currentViewerPlayerId: null, pinAttempts: 0 },
            timer: {
              enabled: config.timerEnabled,
              durationSec: config.timerDurationSec,
              remainingSec: config.timerDurationSec,
              timeoutAction: 'autoCheckOrFold',
              isPaused: true,
            },
            actionLog: [],
          };
          return startHand(fresh, random, Date.now());
        });
      },

      submitAction: (action, timestamp = Date.now()) => {
        set((state) => {
          let next = applyAction(state, action, timestamp);
          if (next.phase === 'showdown') next = resolveShowdown(next);
          else if (next.phase === 'handComplete') next = resolveFoldWin(next);
          if (next.phase === 'handComplete') next = finalizeHandComplete(next);
          return next;
        });
      },

      startNextHand: (random = Math.random, timestamp = Date.now()) => {
        set((state) => {
          if (state.phase !== 'handComplete') {
            throw new Error(`startNextHand: expected handComplete, got ${state.phase}`);
          }
          if (!state.dealerButtonPlayerId) {
            throw new Error('startNextHand: dealerButtonPlayerId is null');
          }
          const resetState: GameState = {
            ...state,
            handNumber: state.handNumber + 1,
            phase: 'postingBlinds',
            players: resetPlayersForNextHand(state.players),
            dealerButtonPlayerId: nextButtonPlayerId(state.players, state.dealerButtonPlayerId),
            pots: [],
            communityCards: [],
            deck: createDeck(),
            betting: EMPTY_BETTING,
            activePlayerId: null,
          };
          return startHand(resetState, random, timestamp);
        });
      },
    }),
    {
      name: 'pass-and-play-poker',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? window.localStorage : noopStorage)),
      partialize: (state): PersistedGameState => ({
        handNumber: state.handNumber,
        phase: state.phase,
        config: state.config,
        players: state.players,
        activePlayerId: state.activePlayerId,
        dealerButtonPlayerId: state.dealerButtonPlayerId,
        betting: state.betting,
        pots: state.pots,
        communityCards: state.communityCards,
        deck: state.deck,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PersistedGameState> | undefined;
        return {
          ...currentState,
          ...persisted,
          handoff: { step: 'locked', targetPlayerId: null, currentViewerPlayerId: null, pinAttempts: 0 },
          timer: { ...currentState.timer, remainingSec: currentState.timer.durationSec, isPaused: true },
          actionLog: [],
        };
      },
    },
  ),
);
