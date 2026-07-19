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

function Screen() {
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
