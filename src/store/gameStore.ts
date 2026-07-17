// Web アプリ用の gameStore シングルトン。ロジック本体は @pass-and-play/core/store にあり、
// ここでは Web の storage(localStorage)を注入するだけ。既存の '@/store/gameStore' import を維持する
import { createGameStore, noopStorage } from '@pass-and-play/core/store';

export {
  validateGameConfig,
  selectVisibleCards,
  selectHandCompleteView,
  type HandCompleteEntry,
} from '@pass-and-play/core/store';

export const useGameStore = createGameStore(() =>
  typeof window !== 'undefined' ? window.localStorage : noopStorage,
);
