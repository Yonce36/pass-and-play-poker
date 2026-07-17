import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useGameStore } from '../store';
import { colors } from '../theme';
import { ChipAmount } from './CardView';

/**
 * reveal 中のみ表示される手番プレイヤーの操作パネル(Web版 ActionPanel の 1:1 移植)。
 * 合法性の最終判定は core の applyAction が行う(ここでの活性制御はUXのための事前フィルタに過ぎない)。
 * アクション確定後は必ず concealCards() を呼び、手札をネイティブツリーから即座に取り除く(漏洩防止)。
 * cards を含む Player を props で受けず、viewerId から必要なフィールドだけ store で参照する。
 */
export function ActionPanel({ viewerId }: { viewerId: string }) {
  const betting = useGameStore((s) => s.betting);
  const players = useGameStore((s) => s.players);
  const submitAction = useGameStore((s) => s.submitAction);
  const concealCards = useGameStore((s) => s.concealCards);
  const viewer = useGameStore((s) => s.players.find((p) => p.id === viewerId));
  const [amount, setAmount] = useState(betting.minRaiseTo);
  const [error, setError] = useState<string | null>(null);

  if (!viewer) return null;

  const potTotal = players.reduce((sum, p) => sum + p.totalContribution, 0);
  const maxReachable = viewer.currentBet + viewer.chips;
  const facingBet = betting.currentMaxBet > 0;
  const canCheck = viewer.currentBet === betting.currentMaxBet;
  const callAmount = Math.min(betting.currentMaxBet - viewer.currentBet, viewer.chips);
  const canCall = facingBet && viewer.currentBet < betting.currentMaxBet;
  const raiseBlocked = viewer.hasActedThisRound && !viewer.hasOption;
  const canBetOrRaise = maxReachable >= betting.minRaiseTo && (!facingBet || !raiseBlocked);
  const canAllIn = viewer.chips > 0;

  const clamp = (v: number) => Math.min(Math.max(v, betting.minRaiseTo), maxReachable);
  // ポットサイズベット(現在のポット+コール分を足した到達額)の目安
  const potBet = clamp(betting.currentMaxBet + potTotal + (canCall ? callAmount : 0));

  const act = (
    type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allIn',
    actionAmount?: number,
  ) => {
    try {
      submitAction({ playerId: viewer.id, type, amount: actionAmount });
      setError(null);
      concealCards();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={styles.panel}>
      <View style={styles.statusRow}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>ポット </Text>
          <ChipAmount amount={potTotal} color={colors.zinc200} />
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>残り </Text>
          <ChipAmount amount={viewer.chips} color={colors.zinc200} />
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.row}>
        <Pressable
          onPress={() => act('fold')}
          style={({ pressed }) => [styles.button, styles.foldButton, pressed && styles.pressed]}
        >
          <Text style={styles.foldText}>フォールド</Text>
        </Pressable>
        {canCheck ? (
          <Pressable
            onPress={() => act('check')}
            style={({ pressed }) => [styles.button, styles.callButton, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>チェック</Text>
          </Pressable>
        ) : (
          <Pressable
            disabled={!canCall}
            onPress={() => act('call')}
            style={({ pressed }) => [
              styles.button,
              styles.callButton,
              !canCall && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.buttonText}>コール {callAmount}</Text>
          </Pressable>
        )}
      </View>

      {canBetOrRaise && (
        <View style={styles.betBox}>
          <View style={styles.betHeader}>
            <Text style={styles.betLabel}>{facingBet ? 'レイズ額(到達額)' : 'ベット額'}</Text>
            <TextInput
              keyboardType="number-pad"
              value={String(amount)}
              onChangeText={(t) => setAmount(Number(t.replace(/\D/g, '')) || 0)}
              style={styles.betInput}
            />
          </View>
          <Slider
            minimumValue={betting.minRaiseTo}
            maximumValue={maxReachable}
            step={1}
            value={clamp(amount)}
            onValueChange={(v) => setAmount(Math.round(v))}
            minimumTrackTintColor={colors.amber300}
            maximumTrackTintColor={colors.zinc700}
            thumbTintColor={colors.gold}
          />
          <View style={styles.presetRow}>
            <Pressable onPress={() => setAmount(betting.minRaiseTo)} style={styles.preset}>
              <Text style={styles.presetText}>最小 {betting.minRaiseTo}</Text>
            </Pressable>
            <Pressable onPress={() => setAmount(potBet)} style={styles.preset}>
              <Text style={styles.presetText}>ポット</Text>
            </Pressable>
            <Pressable onPress={() => setAmount(maxReachable)} style={styles.preset}>
              <Text style={styles.presetText}>最大</Text>
            </Pressable>
          </View>
          <Pressable
            disabled={amount < betting.minRaiseTo || amount > maxReachable}
            onPress={() => act(facingBet ? 'raise' : 'bet', amount)}
            style={({ pressed }) => [
              styles.button,
              styles.betButton,
              (amount < betting.minRaiseTo || amount > maxReachable) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.buttonText}>
              {facingBet ? `レイズ to ${clamp(amount)}` : `ベット ${clamp(amount)}`}
            </Text>
          </Pressable>
        </View>
      )}

      <Pressable
        disabled={!canAllIn}
        onPress={() => act('allIn')}
        style={({ pressed }) => [
          styles.button,
          styles.allInButton,
          !canAllIn && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.buttonText}>オールイン {maxReachable}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%', maxWidth: 384, gap: 12 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: 'rgba(24,24,27,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusItem: { flexDirection: 'row', alignItems: 'center' },
  statusLabel: { fontSize: 14, color: colors.zinc400 },
  error: { textAlign: 'center', fontSize: 14, color: colors.red600 },
  row: { flexDirection: 'row', gap: 8 },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foldButton: { flex: 1, backgroundColor: colors.zinc800, borderWidth: 1, borderColor: colors.white10 },
  foldText: { fontWeight: '700', color: colors.zinc200 },
  callButton: { flex: 1, backgroundColor: colors.sky700 },
  betButton: { backgroundColor: colors.emerald600 },
  allInButton: { backgroundColor: colors.rose600 },
  buttonText: { fontWeight: '700', color: '#ffffff' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  betBox: {
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: 'rgba(24,24,27,0.85)',
    padding: 12,
  },
  betHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  betLabel: { fontSize: 12, color: colors.zinc400 },
  betInput: {
    width: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.zinc700,
    backgroundColor: colors.zinc950,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: 'right',
    fontSize: 18,
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
  presetRow: { flexDirection: 'row', gap: 8 },
  preset: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: colors.zinc800,
    borderWidth: 1,
    borderColor: colors.white10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  presetText: { fontSize: 13, color: colors.zinc300 },
});
