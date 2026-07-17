import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useGameStore } from '../store';

/**
 * CLAUDE.md 手札漏洩防止 / STATE_MACHINE 4 の RN 版(Web版の visibilitychange/blur/pagehide と対):
 * 1. AppState が active 以外(inactive = アプリスイッチャー/通知シェード、background)に遷移したら
 *    即座に handoff.step を 'locked' へ落とし、手札を条件付きレンダリングでネイティブツリーから消す。
 *    ただし iOS のスナップショット取得と JS 再レンダリングの競合は保証がないため(leak-auditor W-2)、
 *    実機検証チェックリストで確認する。
 * 2. expo-screen-capture でスクリーンキャプチャを常時禁止(leak-auditor W-1)。
 *    Android は FLAG_SECURE によりスクリーンショット・録画・Recents サムネイルが黒画面になる。
 */
export function HandoffGuard() {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') useGameStore.getState().lock();
    });
    ScreenCapture.preventScreenCaptureAsync();
    return () => {
      sub.remove();
      ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  return null;
}
