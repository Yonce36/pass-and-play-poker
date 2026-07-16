'use client';

import { useGameStore } from '@/store/gameStore';
import { SetupScreen } from '@/components/SetupScreen';
import { TableScreen } from '@/components/TableScreen';
import { HandCompleteScreen } from '@/components/HandCompleteScreen';
import { GameOverScreen } from '@/components/GameOverScreen';

export default function Home() {
  const phase = useGameStore((s) => s.phase);

  switch (phase) {
    case 'setup':
      return <SetupScreen />;
    case 'handComplete':
      return <HandCompleteScreen />;
    case 'gameOver':
      return <GameOverScreen />;
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
