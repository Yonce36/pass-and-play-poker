import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useGameStore } from './src/store';
import { gradients } from './src/theme';
import { HandoffGuard } from './src/components/HandoffGuard';
import { SetupScreen } from './src/components/SetupScreen';
import { TableScreen } from './src/components/TableScreen';
import { HandCompleteScreen } from './src/components/HandCompleteScreen';
import { GameOverScreen } from './src/components/GameOverScreen';

/**
 * gameOver 直行時(all-in で敗者が bust)も最終ハンドのショーダウンを先に見せる。
 * phase が gameOver を離れるとアンマウントされ finalHandSeen は自然にリセットされる。
 */
function GameOverFlow() {
  const [finalHandSeen, setFinalHandSeen] = useState(false);
  if (finalHandSeen) return <GameOverScreen />;
  return <HandCompleteScreen onNext={() => setFinalHandSeen(true)} nextLabel="最終結果へ" />;
}

function Screen() {
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

export default function App() {
  // AsyncStorage の hydration は非同期。完了前に描画すると進行中ゲームの復元前に
  // SetupScreen が一瞬表示され、そこで startGame すると永続状態を上書きし得る(leak-auditor W-3)。
  // 完了までは背景色のみを表示する
  const [hydrated, setHydrated] = useState(useGameStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useGameStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  return (
    <SafeAreaProvider>
      <LinearGradient colors={gradients.screen} style={styles.root}>
        <SafeAreaView style={styles.root}>
          <StatusBar style="light" />
          <HandoffGuard />
          {hydrated && <Screen />}
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
