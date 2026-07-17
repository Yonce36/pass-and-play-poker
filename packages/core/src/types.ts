// 型定義 — docs/SPEC.md セクション3 を正とする

// 3.1 カード
export type Suit = 'H' | 'D' | 'C' | 'S';
export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'T'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';
export type Card = `${Suit}${Rank}`;

// 3.2 フェーズ（進行状態の単一の真実）
export type GamePhase =
  | 'setup'
  | 'postingBlinds'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'handComplete'
  | 'gameOver';

// 3.3 プレイヤー
export type PlayerStatus = 'active' | 'folded' | 'allIn' | 'busted' | 'sittingOut';

export interface Player {
  id: string;
  seatIndex: number;
  name: string;
  pin: string | null;

  chips: number;
  currentBet: number;
  totalContribution: number;
  cards: Card[];

  status: PlayerStatus;

  hasActedThisRound: boolean;
  hasOption: boolean;
}

// 3.4 ゲーム設定
export interface GameConfig {
  smallBlind: number;
  bigBlind: number;
  startingChips: number;
  minPlayers: number;
  maxPlayers: number;
  allowedPlayerCount: 2 | 3 | 4 | 5 | 6;

  timerEnabled: boolean;
  timerDurationSec: number;
  oddChipRule: 'clockwiseFromButton';
}

// 3.5 ベッティング状態
export interface BettingState {
  actingOrder: string[];
  currentMaxBet: number;
  minRaiseTo: number;
  lastFullRaiseAmount: number;
  lastAggressorPlayerId: string | null;
  firstActorPlayerId: string | null;
}

// 3.6 ポット
export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
  sourceContributionLevel?: number;
}

// 3.7 アクションログ
export type ActionType =
  | 'blind'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'fold'
  | 'allIn'
  | 'timeout';

export interface ActionLog {
  id: string;
  handNumber: number;
  street: GamePhase;
  playerId: string;
  action: ActionType;
  amount: number;
  resultingBet: number;
  timestamp: number;
}

// 3.8 ハンドオフ状態
export type HandoffStep = 'idle' | 'confirm1' | 'confirm2' | 'pinEntry' | 'reveal' | 'locked';

export interface HandoffState {
  step: HandoffStep;
  targetPlayerId: string | null;
  currentViewerPlayerId: string | null;
  pinAttempts: number;
}

// 3.9 タイマー
export interface TimerState {
  enabled: boolean;
  durationSec: number;
  remainingSec: number;
  timeoutAction: 'autoCheckOrFold' | 'foldOnly';
  isPaused: boolean;
}

// 3.10 ショーダウン結果
export type HandRank =
  | 'highCard'
  | 'onePair'
  | 'twoPair'
  | 'threeOfAKind'
  | 'straight'
  | 'flush'
  | 'fullHouse'
  | 'fourOfAKind'
  | 'straightFlush';

export interface HandResult {
  playerId: string;
  handRank: HandRank;
  bestFiveCards: Card[];
  score: number[];
}

// 3.11 GameState（ルート）
export interface GameState {
  handNumber: number;
  phase: GamePhase;
  config: GameConfig;
  players: Player[];
  activePlayerId: string | null;
  dealerButtonPlayerId: string | null;
  betting: BettingState;
  pots: Pot[];
  communityCards: Card[];
  deck: Card[];
  handoff: HandoffState;
  timer: TimerState;
  actionLog: ActionLog[];
}
