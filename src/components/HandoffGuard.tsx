'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';

/**
 * CLAUDE.md 手札漏洩防止 / STATE_MACHINE 4:
 * visibilitychange(hidden) / blur / pagehide のいずれでも handoff.step を強制的に 'locked' へ落とす。
 * DOM も props も一切扱わず、store の lock() を呼ぶだけ（ゲームロジックはstore/core側の責務）。
 */
export function HandoffGuard() {
  useEffect(() => {
    const lock = () => useGameStore.getState().lock();
    const onVisibilityChange = () => {
      if (document.hidden) lock();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', lock);
    window.addEventListener('pagehide', lock);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', lock);
      window.removeEventListener('pagehide', lock);
    };
  }, []);

  return null;
}
