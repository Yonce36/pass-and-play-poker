import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { GameConfig } from '@pass-and-play/core';
import { useGameStore, validateGameConfig } from '../store';
import { haptics } from '../haptics';
import { colors } from '../theme';
import { CardBack } from './CardView';

const DEFAULTS = { startingChips: 1000, smallBlind: 10, bigBlind: 20 };

function NumberField({
  label,
  value,
  onChange,
  flex,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  flex?: boolean;
}) {
  return (
    <View style={[styles.field, flex && { flex: 1 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType="number-pad"
        value={String(value)}
        onChangeText={(t) => onChange(Number(t.replace(/\D/g, '')) || 0)}
        style={styles.input}
      />
    </View>
  );
}

export function SetupScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const [name1, setName1] = useState('プレイヤー1');
  const [name2, setName2] = useState('プレイヤー2');
  const [startingChips, setStartingChips] = useState(DEFAULTS.startingChips);
  const [smallBlind, setSmallBlind] = useState(DEFAULTS.smallBlind);
  const [bigBlind, setBigBlind] = useState(DEFAULTS.bigBlind);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const configOverrides: Partial<GameConfig> = { startingChips, smallBlind, bigBlind };
    try {
      validateGameConfig({
        smallBlind,
        bigBlind,
        startingChips,
        minPlayers: 2,
        maxPlayers: 6,
        allowedPlayerCount: 2,
        timerEnabled: false,
        timerDurationSec: 30,
        oddChipRule: 'clockwiseFromButton',
      });
      startGame([name1.trim() || 'プレイヤー1', name2.trim() || 'プレイヤー2'], configOverrides);
      haptics.confirm();
      setError(null);
    } catch (err) {
      haptics.error();
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <View style={styles.heroCards}>
          <View style={{ transform: [{ rotate: '-6deg' }], marginRight: -32 }}>
            <CardBack size="md" />
          </View>
          <View style={{ transform: [{ rotate: '6deg' }] }}>
            <CardBack size="md" />
          </View>
        </View>
        <Text style={styles.title}>
          Pass & Play <Text style={{ color: colors.gold }}>Poker</Text>
        </Text>
        <Text style={styles.subtitle}>1台のスマホを手渡しして遊ぶテキサスホールデム</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>プレイヤー</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>プレイヤー1の名前</Text>
          <TextInput value={name1} onChangeText={setName1} maxLength={20} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>プレイヤー2の名前</Text>
          <TextInput value={name2} onChangeText={setName2} maxLength={20} style={styles.input} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>テーブル設定</Text>
        <NumberField label="初期チップ" value={startingChips} onChange={setStartingChips} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <NumberField label="SB" value={smallBlind} onChange={setSmallBlind} flex />
          <NumberField label="BB" value={bigBlind} onChange={setBigBlind} flex />
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable onPress={handleSubmit} style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}>
        <Text style={styles.startButtonText}>ゲーム開始</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', gap: 20, padding: 24 },
  hero: { alignItems: 'center', gap: 12 },
  heroCards: { flexDirection: 'row' },
  title: { fontSize: 30, fontWeight: '900', color: colors.foreground, textAlign: 'center' },
  subtitle: { fontSize: 12, color: colors.zinc500, textAlign: 'center' },
  section: {
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: 'rgba(24,24,27,0.6)',
    padding: 16,
  },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 2, color: colors.zinc500 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: colors.zinc300 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.zinc700,
    backgroundColor: colors.zinc900,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 16,
  },
  error: { fontSize: 14, color: colors.red600 },
  startButton: {
    borderRadius: 999,
    backgroundColor: colors.emerald600,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
