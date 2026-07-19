'use client';

import { useGameStore } from '@/store/gameStore';
import { SetupScreen } from '@/components/SetupScreen';
import { TableScreen } from '@/components/TableScreen';
import { HandCompleteScreen } from '@/components/HandCompleteScreen';

export default function Home() {
  const phase = useGameStore((s) => s.phase);

  switch (phase) {
    case 'setup':
      return <SetupScreen />;
    case 'handComplete':
    case 'gameOver':
      // gameOver 直行時も HandCompleteScreen が最終ハンド→GameOverScreen を内部で切り替える
      return <HandCompleteScreen />;
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
