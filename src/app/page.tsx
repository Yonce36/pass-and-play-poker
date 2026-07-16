'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { SetupScreen } from '@/components/SetupScreen';
import { TableScreen } from '@/components/TableScreen';
import { HandCompleteScreen } from '@/components/HandCompleteScreen';
import { GameOverScreen } from '@/components/GameOverScreen';

/**
 * gameOver 直行時(all-in で敗者が bust)も最終ハンドのショーダウンを先に見せる。
 * phase が gameOver を離れるとアンマウントされ finalHandSeen は自然にリセットされる。
 */
function GameOverFlow() {
  const [finalHandSeen, setFinalHandSeen] = useState(false);
  if (finalHandSeen) return <GameOverScreen />;
  return <HandCompleteScreen onNext={() => setFinalHandSeen(true)} nextLabel="最終結果へ" />;
}

export default function Home() {
  const phase = useGameStore((s) => s.phase);

  switch (phase) {
    case 'setup':
      return <SetupScreen />;
    case 'handComplete':
      return <HandCompleteScreen />;
    case 'gameOver':
      return <GameOverFlow />;
    case 'postingBlinds':
    case 'preflop':
    case 'flop':
    case 'turn':
    case 'river':
    case 'showdown':
      return <TableScreen />;
    default:
      return null;
  }
}
