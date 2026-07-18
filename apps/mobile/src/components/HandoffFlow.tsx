import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Player } from '@pass-and-play/core';
import { selectVisibleCards, useGameStore } from '../store';
import { haptics } from '../haptics';
import { colors } from '../theme';
import { CardBack } from './CardView';
import { FlipCard } from './FlipCard';
import { ActionPanel } from './ActionPanel';

/**
 * handoff 状態機械の描画(Web版 HandoffFlow の 1:1 移植)。
 * 手札は reveal 中に selectVisibleCards 経由でのみ描画する(条件付きレンダリング)。
 */

type SafePlayer = Pick<Player, 'id' | 'name'>;

const toSafe = (p: Pick<Player, 'id' | 'name'>): SafePlayer => ({ id: p.id, name: p.name });

/** confirm/pinEntry/reveal を覆う全画面オーバーレイ(不透明。背後のテーブル情報も遮蔽する) */
function Overlay({ children }: { children: React.ReactNode }) {
  return <View style={styles.overlay}>{children}</View>;
}

/** idle / locked: 次に行動するプレイヤーへ端末を渡す案内(テーブルの下に出るバー) */
function PassScreen({ target }: { target: SafePlayer }) {
  const beginHandoff = useGameStore((s) => s.beginHandoff);
  return (
    <View style={styles.passBar}>
      <Text style={styles.passText}>
        端末を <Text style={styles.goldBold}>{target.name}</Text> さんに渡してください
      </Text>
      <Pressable
        onPress={() => {
          haptics.receive();
          beginHandoff(target.id);
        }}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>{target.name} です — 受け取りました</Text>
      </Pressable>
    </View>
  );
}

/** confirm1: 本人確認(PINなし) */
function ConfirmIdentityScreen({ target }: { target: SafePlayer }) {
  const confirmIdentity = useGameStore((s) => s.confirmIdentity);
  const lock = useGameStore((s) => s.lock);
  return (
    <Overlay>
      <View style={styles.centerColumn}>
        <View style={styles.backCards}>
          <View style={{ marginRight: -24 }}>
            <CardBack size="lg" />
          </View>
          <CardBack size="lg" />
        </View>
        <Text style={styles.heading}>
          あなたは <Text style={styles.goldBold}>{target.name}</Text> さんですか？
        </Text>
        <Pressable
          onPress={() => {
            haptics.light();
            confirmIdentity();
          }}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>はい、{target.name} です</Text>
        </Pressable>
        <Pressable onPress={lock}>
          <Text style={styles.linkText}>違います（戻る）</Text>
        </Pressable>
      </View>
    </Overlay>
  );
}

/** pinEntry: PIN入力(4桁一致で reveal、不一致は pinAttempts++)。PIN照合は store 側で行う */
function PinEntryScreen({ target, pinAttempts }: { target: SafePlayer; pinAttempts: number }) {
  const submitPin = useGameStore((s) => s.submitPin);
  const lock = useGameStore((s) => s.lock);
  const [pin, setPin] = useState('');

  return (
    <Overlay>
      <View style={styles.centerColumn}>
        <Text style={styles.heading}>{target.name} さんのPINを入力してください</Text>
        <TextInput
          secureTextEntry
          keyboardType="number-pad"
          maxLength={4}
          value={pin}
          onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
          style={styles.pinInput}
        />
        {pinAttempts > 0 && <Text style={styles.error}>PINが違います（{pinAttempts}回目）</Text>}
        <Pressable
          disabled={pin.length !== 4}
          onPress={() => {
            submitPin(pin);
            setPin('');
            // PIN照合はstore内で同期に完了する。結果に応じた触覚を返す
            if (useGameStore.getState().handoff.step === 'reveal') haptics.reveal();
            else haptics.error();
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            pin.length !== 4 && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>確認</Text>
        </Pressable>
        <Pressable onPress={lock}>
          <Text style={styles.linkText}>戻る</Text>
        </Pressable>
      </View>
    </Overlay>
  );
}

/**
 * confirm2: 長押しで reveal へ。
 * Web版の一方向スライドに相当する「意図的な操作」の担保。ネイティブ Slider は
 * 実機でクラッシュすることがあったため長押しに置き換えた(ユーザー指示)。
 */
function HoldRevealScreen({ target }: { target: SafePlayer }) {
  const revealCards = useGameStore((s) => s.revealCards);
  // onLongPress の多重発火保険。revealCards() は confirm2 以外で throw するため一度だけ呼ぶ
  const firedRef = useRef(false);

  return (
    <Overlay>
      <View style={styles.centerColumn}>
        <View style={styles.backCards}>
          <View style={{ marginRight: -24 }}>
            <CardBack size="lg" />
          </View>
          <CardBack size="lg" />
        </View>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={styles.heading}>
            <Text style={styles.goldBold}>{target.name}</Text> さん、準備はいいですか？
          </Text>
          <Text style={styles.subText}>まわりに見られていないか確認してください</Text>
        </View>
        <Pressable
          delayLongPress={600}
          onPressIn={haptics.tick}
          onLongPress={() => {
            if (!firedRef.current) {
              firedRef.current = true;
              haptics.reveal();
              revealCards();
            }
          }}
          style={({ pressed }) => [styles.holdButton, pressed && styles.holdButtonPressed]}
        >
          <Text style={styles.holdButtonText}>長押しして手札を表示</Text>
        </Pressable>
      </View>
    </Overlay>
  );
}

/**
 * reveal: 自分の手札 + アクションパネル。
 * Web版の history 制御に対応するものとして、Android のハードウェアバックを握って
 * lock() に変換する(reveal を残したまま戻る操作をさせない。STATE_MACHINE 4 不変条件)。
 */
function RevealScreen({ viewer }: { viewer: SafePlayer }) {
  const cards = useGameStore(selectVisibleCards);
  const lock = useGameStore((s) => s.lock);
  const concealCards = useGameStore((s) => s.concealCards);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      lock();
      return true;
    });
    return () => sub.remove();
  }, [lock]);

  return (
    <Overlay>
      <ScrollView contentContainerStyle={styles.revealContainer}>
        <Text style={styles.subText}>
          <Text style={styles.goldBold}>{viewer.name}</Text> さんの手札
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {cards?.map((c, i) => (
            <FlipCard key={c} card={c} size="lg" delay={i * 130} duration={380} />
          ))}
        </View>
        <ActionPanel viewerId={viewer.id} />
        <Pressable onPress={concealCards} style={{ marginTop: 8 }}>
          <Text style={styles.linkText}>伏せる（アクションしない）</Text>
        </Pressable>
      </ScrollView>
    </Overlay>
  );
}

/** phase が betting phase のときの handoff 状態機械の描画(idle/locked/confirm1/confirm2/pinEntry/reveal) */
export function HandoffFlow({ activePlayer }: { activePlayer: SafePlayer }) {
  const handoff = useGameStore((s) => s.handoff);
  const players = useGameStore((s) => s.players);

  const targetPlayer = handoff.targetPlayerId
    ? players.find((p) => p.id === handoff.targetPlayerId)
    : undefined;
  // cards を含む Player を子コンポーネントへ流さない(STATE_MACHINE 4 不変条件)
  const target = targetPlayer ? toSafe(targetPlayer) : undefined;

  switch (handoff.step) {
    case 'idle':
    case 'locked':
      return <PassScreen target={toSafe(activePlayer)} />;
    case 'confirm1':
      return target ? <ConfirmIdentityScreen target={target} /> : null;
    case 'confirm2':
      return target ? <HoldRevealScreen target={target} /> : null;
    case 'pinEntry':
      return target ? <PinEntryScreen target={target} pinAttempts={handoff.pinAttempts} /> : null;
    case 'reveal':
      return target ? <RevealScreen viewer={target} /> : null;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: colors.zinc950,
  },
  passBar: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: 'rgba(24,24,27,0.85)',
    padding: 16,
  },
  passText: { fontSize: 14, color: colors.zinc400, textAlign: 'center' },
  goldBold: { color: colors.gold, fontWeight: '700' },
  primaryButton: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 999,
    backgroundColor: colors.emerald600,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
  centerColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    padding: 24,
  },
  backCards: { flexDirection: 'row', opacity: 0.8 },
  heading: { fontSize: 24, fontWeight: '700', color: colors.foreground, textAlign: 'center' },
  subText: { fontSize: 14, color: colors.zinc400, textAlign: 'center' },
  linkText: { fontSize: 14, color: colors.zinc500, textDecorationLine: 'underline' },
  error: { fontSize: 14, color: colors.red600 },
  pinInput: {
    width: 128,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.zinc700,
    backgroundColor: colors.zinc900,
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    color: '#ffffff',
  },
  holdButton: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.zinc900,
    paddingVertical: 16,
    alignItems: 'center',
  },
  holdButtonPressed: { backgroundColor: colors.emerald700, borderColor: colors.emerald600 },
  holdButtonText: { fontSize: 15, fontWeight: '600', color: colors.zinc300 },
  revealContainer: {
    flexGrow: 1,
    alignItems: 'center',
    gap: 20,
    padding: 20,
  },
});
