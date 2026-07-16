// gameStore — Zustand store。core関数(deck/betting/sidePot/showdown/handEval)を
// action から呼ぶ一方向構成。乱数・時刻はここで注入する（SPEC 3〜5、STATE_MACHINE 1・3 準拠）
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { applyAction, postBlinds, type PlayerAction } from '@/core/betting';
import { createDeck, shuffleDeck } from '@/core/deck';
import { evaluateHand } from '@/core/handEval';
import { distributePots, type Payouts } from '@/core/showdown';
import { buildPots } from '@/core/sidePot';
import type {
  BettingState,
  Card,
  GameConfig,
  GameState,
  HandRank,
  HandResult,
  Player,
} from '@/types';

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

/** SPEC 2: BB > SB、startingChips > BB、すべて正整数。startGame境界での必須バリデーション */
export function validateGameConfig(config: GameConfig): void {
  const positiveInts: Array<[string, number]> = [
    ['smallBlind', config.smallBlind],
    ['bigBlind', config.bigBlind],
    ['startingChips', config.startingChips],
  ];
  for (const [name, value] of positiveInts) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`validateGameConfig: ${name} must be a positive integer`);
    }
  }
  if (config.bigBlind <= config.smallBlind) {
    throw new Error('validateGameConfig: bigBlind must be greater than smallBlind');
  }
  if (config.startingChips <= config.bigBlind) {
    throw new Error('validateGameConfig: startingChips must be greater than bigBlind');
  }
}

/**
 * handoff中の対象プレイヤーの手札のみを返す selector（leak-auditor W-1対応）。
 * UIコンポーネントは players[].cards を直接 subscribe せず、必ずこれ経由で取得する。
 * reveal 以外、または currentViewerPlayerId 未設定のときは null（DOM に一切出さないため）。
 */
export function selectVisibleCards(state: GameState): Card[] | null {
  if (state.handoff.step !== 'reveal' || !state.handoff.currentViewerPlayerId) return null;
  const viewer = state.players.find((p) => p.id === state.handoff.currentViewerPlayerId);
  return viewer ? viewer.cards : null;
}

export interface HandCompleteEntry {
  playerId: string;
  name: string;
  amount: number;
  /** showdown のときのみ。fold勝ちでは null（手札公開なし） */
  handRank: HandRank | null;
  cards: Card[] | null;
  /** showdown のときのみ。役に使われた最良5枚（UIのハイライト用） */
  bestFiveCards: Card[] | null;
}

/**
 * handComplete 画面の表示用ビュー（leak-auditor C-1/W-1 対応）。
 * ゲームロジックをコンポーネントに書かないため、core の再計算はここに集約する。
 * showdown 参加者の判定は「非fold・非sittingOut で当ハンドに拠出があり手札を持つ」で行う。
 * finalizeHandComplete 後は敗者が busted に変わるため status active/allIn だけでは判定できず、
 * 逆に status !== 'folded' だけでは前ハンドまでに busted した傍観者（拠出0）が混入し
 * fold勝ちを showdown と誤認して手札を公開してしまう（3人以上で発生）。
 */
export function selectHandCompleteView(state: GameState): {
  potTotal: number;
  isShowdown: boolean;
  entries: HandCompleteEntry[];
} {
  const potTotal = state.players.reduce((sum, p) => sum + p.totalContribution, 0);
  const participants = state.players.filter(
    (p) =>
      p.status !== 'folded' &&
      p.status !== 'sittingOut' &&
      p.totalContribution > 0 &&
      p.cards.length > 0,
  );
  const isShowdown = participants.length >= 2 && state.dealerButtonPlayerId !== null;

  if (!isShowdown) {
    // fold勝ち: 唯一の残存者が全ポット獲得。手札は公開しない（STATE_MACHINE 3）
    const winner = state.players.find((p) => p.status === 'active' || p.status === 'allIn');
    return {
      potTotal,
      isShowdown: false,
      entries: winner
        ? [
            {
              playerId: winner.id,
              name: winner.name,
              amount: potTotal,
              handRank: null,
              cards: null,
              bestFiveCards: null,
            },
          ]
        : [],
    };
  }

  // showdown: resolveShowdown と同じ core 関数から表示専用に再導出する
  // （busted になった敗者は buildPots の eligible から外れるが、敗者の獲得額は元々 0 のため表示結果は一致する）
  const results = participants.map((p) => evaluateHand(p.id, p.cards, state.communityCards));
  const payouts = distributePots(
    buildPots(state.players),
    results,
    state.players,
    state.dealerButtonPlayerId!,
  );
  const resultById = new Map(results.map((r) => [r.playerId, r]));
  return {
    potTotal,
    isShowdown: true,
    entries: participants.map((p) => ({
      playerId: p.id,
      name: p.name,
      amount: payouts[p.id] ?? 0,
      handRank: resultById.get(p.id)!.handRank,
      cards: p.cards,
      bestFiveCards: resultById.get(p.id)!.bestFiveCards,
    })),
  };
}

interface GameStore extends GameState {
  /**
   * all-in ランアウト演出用(UI専用・persist対象外)。ランアウト発生時、
   * 公開済みだったコミュニティカード枚数(0/3/4)。null = 演出なし(通常showdown/fold勝ち)。
   * カード情報は含まず枚数のみなので漏洩リスクはない。
   */
  runOutFrom: number | null;
  startGame: (playerNames: string[], configOverrides?: Partial<GameConfig>, random?: () => number) => void;
  submitAction: (action: PlayerAction, timestamp?: number) => void;
  startNextHand: (random?: () => number, timestamp?: number) => void;
  /** STATE_MACHINE 4: idle/locked から交代を開始する。PINありなら pinEntry、なしなら confirm1 */
  beginHandoff: (targetPlayerId: string) => void;
  /** confirm1 → confirm2 */
  confirmIdentity: () => void;
  /** confirm2 の一方向スワイプ完了 → reveal */
  revealCards: () => void;
  /** pinEntry でのPIN入力。一致で reveal、不一致で pinAttempts++ のまま pinEntry に留まる */
  submitPin: (pin: string) => void;
  /** reveal → idle（次の handoff に備える） */
  concealCards: () => void;
  /** 任意の状態から locked へ（visibilitychange/blur/pagehide/復元 用） */
  lock: () => void;
  /** gameOver から setup へ戻る（新しいゲームを始める） */
  resetToSetup: () => void;
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

const INITIAL_STATE: GameState = {
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
};

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      runOutFrom: null,

      /** gameOver から setup へ戻り、新しいゲームを開始できる状態にリセットする */
      resetToSetup: () => set(() => ({ ...INITIAL_STATE, runOutFrom: null })),

      startGame: (playerNames, configOverrides, random = Math.random) => {
        set(() => {
          const config: GameConfig = { ...DEFAULT_CONFIG, ...configOverrides };
          validateGameConfig(config);
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
          const started = startHand(fresh, random, Date.now());
          // ブラインドだけで全員all-inの端ケース: コミュニティ0枚からのランアウト演出
          return { ...started, runOutFrom: started.communityCards.length === 5 ? 0 : null };
        });
      },

      submitAction: (action, timestamp = Date.now()) => {
        set((state) => {
          const publicCardsBefore = state.communityCards.length;
          let next = applyAction(state, action, timestamp);
          // showdown で公開枚数が一気に5枚へ飛んだ = all-in ランアウト（endStreet の一括公開）
          const runOutFrom =
            next.phase === 'showdown' && publicCardsBefore < 5 ? publicCardsBefore : null;
          if (next.phase === 'showdown') next = resolveShowdown(next);
          else if (next.phase === 'handComplete') next = resolveFoldWin(next);
          if (next.phase === 'handComplete') next = finalizeHandComplete(next);
          return { ...next, runOutFrom };
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
          const started = startHand(resetState, random, timestamp);
          return { ...started, runOutFrom: started.communityCards.length === 5 ? 0 : null };
        });
      },

      beginHandoff: (targetPlayerId) => {
        set((state) => {
          const target = state.players.find((p) => p.id === targetPlayerId);
          if (!target) throw new Error(`beginHandoff: unknown playerId ${targetPlayerId}`);
          return {
            handoff: {
              step: target.pin ? 'pinEntry' : 'confirm1',
              targetPlayerId,
              currentViewerPlayerId: null,
              pinAttempts: 0,
            },
          };
        });
      },

      confirmIdentity: () => {
        set((state) => {
          if (state.handoff.step !== 'confirm1') {
            throw new Error(`confirmIdentity: expected confirm1, got ${state.handoff.step}`);
          }
          return { handoff: { ...state.handoff, step: 'confirm2' } };
        });
      },

      revealCards: () => {
        set((state) => {
          if (state.handoff.step !== 'confirm2') {
            throw new Error(`revealCards: expected confirm2, got ${state.handoff.step}`);
          }
          if (!state.handoff.targetPlayerId) throw new Error('revealCards: targetPlayerId is null');
          return {
            handoff: { ...state.handoff, step: 'reveal', currentViewerPlayerId: state.handoff.targetPlayerId },
          };
        });
      },

      submitPin: (pin) => {
        set((state) => {
          if (state.handoff.step !== 'pinEntry') {
            throw new Error(`submitPin: expected pinEntry, got ${state.handoff.step}`);
          }
          const target = state.players.find((p) => p.id === state.handoff.targetPlayerId);
          if (!target) throw new Error('submitPin: targetPlayerId is null or unknown');
          if (target.pin !== null && target.pin === pin) {
            return { handoff: { ...state.handoff, step: 'reveal', currentViewerPlayerId: target.id } };
          }
          return { handoff: { ...state.handoff, pinAttempts: state.handoff.pinAttempts + 1 } };
        });
      },

      concealCards: () => {
        set((state) => {
          if (state.handoff.step !== 'reveal') {
            throw new Error(`concealCards: expected reveal, got ${state.handoff.step}`);
          }
          return { handoff: { step: 'idle', targetPlayerId: null, currentViewerPlayerId: null, pinAttempts: 0 } };
        });
      },

      lock: () => {
        set((state) => ({
          handoff: { ...state.handoff, step: 'locked', currentViewerPlayerId: null },
        }));
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
        // 独立レビューW-2: durationSec は persisted.config.timerDurationSec から導出する（デフォルト固定値に戻さない）
        const durationSec = persisted?.config?.timerDurationSec ?? currentState.timer.durationSec;
        return {
          ...currentState,
          ...persisted,
          handoff: { step: 'locked', targetPlayerId: null, currentViewerPlayerId: null, pinAttempts: 0 },
          timer: { ...currentState.timer, durationSec, remainingSec: durationSec, isPaused: true },
          actionLog: [],
          runOutFrom: null,
        };
      },
    },
  ),
);
