// betting — ベッティングラウンドのエンジン（pure function）
// SPEC 3.5 / 4.1–4.3、STATE_MACHINE セクション2・3 を正とする
import type { ActionType, BettingState, GamePhase, GameState, Player } from '@/types';

/** プレイヤーの能動アクション（blind/timeout はエンジン側で発生させる） */
export interface PlayerAction {
  playerId: string;
  type: Extract<ActionType, 'check' | 'call' | 'bet' | 'raise' | 'fold' | 'allIn'>;
  /** bet/raise/allIn の到達額（currentBet 換算） */
  amount?: number;
}

/**
 * 現ストリートの actingOrder を構築する（SPEC 3.5）。
 * preflop: BBの左隣から時計回り（ヘッズアップは SB=ボタン から）
 * postflop: ボタンの左隣から時計回り（ヘッズアップは BB から）
 */
export function buildActingOrder(
  players: Player[],
  dealerButtonPlayerId: string,
  phase: GamePhase,
): string[] {
  void players;
  void dealerButtonPlayerId;
  void phase;
  throw new Error('not implemented');
}

/** 次手番の playerId を返す（folded/allIn/busted/sittingOut はスキップ）。手番なしは null */
export function getNextActorPlayerId(
  players: Player[],
  betting: BettingState,
  currentActorPlayerId: string | null,
): string | null {
  void players;
  void betting;
  void currentActorPlayerId;
  throw new Error('not implemented');
}

/** アクションを適用した新しい GameState を返す（元の state は変更しない） */
export function applyAction(state: GameState, action: PlayerAction): GameState {
  void state;
  void action;
  throw new Error('not implemented');
}

/** ベッティングラウンド終了判定（SPEC 4.2） */
export function isRoundComplete(players: Player[], betting: BettingState): boolean {
  void players;
  void betting;
  throw new Error('not implemented');
}

/** 全員オールイン等で行動可能な active が1人以下かの判定（自動進行の入口） */
export function shouldAutoRunOut(players: Player[]): boolean {
  void players;
  throw new Error('not implemented');
}
