// Mobile アプリ用の gameStore シングルトン。ロジック本体は @pass-and-play/core にあり、
// ここでは React Native の storage(AsyncStorage)を注入するだけ(Web版 src/store/gameStore.ts と対)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createGameStore } from '@pass-and-play/core';

export {
  validateGameConfig,
  selectVisibleCards,
  selectHandCompleteView,
  type HandCompleteEntry,
} from '@pass-and-play/core';

export const useGameStore = createGameStore(() => AsyncStorage);
