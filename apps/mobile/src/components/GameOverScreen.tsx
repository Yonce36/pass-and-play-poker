import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../store';
import { colors } from '../theme';
import { ChipAmount } from './CardView';

export function GameOverScreen() {
  const players = useGameStore((s) => s.players);
  const resetToSetup = useGameStore((s) => s.resetToSetup);

  const winner = players.find((p) => p.status !== 'busted' && p.status !== 'sittingOut');

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.championLabel}>CHAMPION</Text>
        {winner && (
          <>
            <Text style={styles.winnerName}>{winner.name}</Text>
            <ChipAmount amount={winner.chips} color={colors.gold} fontSize={20} />
          </>
        )}
      </View>

      <View style={styles.list}>
        {players.map((p) => (
          <View
            key={p.id}
            style={[styles.row, p.id === winner?.id ? styles.rowWinner : styles.rowLoser]}
          >
            <Text style={styles.rowName}>{p.name}</Text>
            <ChipAmount amount={p.chips} fontSize={14} />
          </View>
        ))}
      </View>

      <Pressable
        onPress={resetToSetup}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>新しいゲームを始める</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32, padding: 24 },
  hero: { alignItems: 'center', gap: 12 },
  trophy: { fontSize: 60 },
  championLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 4, color: colors.gold },
  winnerName: { fontSize: 36, fontWeight: '900', color: colors.foreground },
  list: { width: '100%', maxWidth: 384, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowWinner: { borderColor: 'rgba(251,191,36,0.6)', backgroundColor: 'rgba(69,26,3,0.3)' },
  rowLoser: { borderColor: colors.white10, backgroundColor: 'rgba(24,24,27,0.85)', opacity: 0.6 },
  rowName: { fontWeight: '600', color: colors.foreground },
  button: {
    width: '100%',
    maxWidth: 384,
    borderRadius: 999,
    backgroundColor: colors.emerald600,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
