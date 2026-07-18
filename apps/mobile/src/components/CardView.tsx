import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Card } from '@pass-and-play/core';
import { colors, gradients } from '../theme';

const SUIT_SYMBOL: Record<string, string> = { H: '♥', D: '♦', C: '♣', S: '♠' };
const RED_SUITS = new Set(['H', 'D']);

function formatRank(rank: string): string {
  return rank === 'T' ? '10' : rank;
}

type CardSize = 'sm' | 'md' | 'lg';

const SIZE: Record<CardSize, { h: number; w: number; r: number; corner: number; center: number }> = {
  sm: { h: 56, w: 40, r: 6, corner: 11, center: 18 },
  md: { h: 72, w: 52, r: 8, corner: 14, center: 24 },
  lg: { h: 96, w: 68, r: 8, corner: 16, center: 36 },
};

/**
 * 1枚の表向きカード。呼び出し側が「表示してよい手札/公開カード」であることを保証すること。
 * dimmed はショーダウンで役に使われなかったカードの減光表示(公開済みカードの装飾であり「隠し」ではない)。
 */
export function CardView({
  card,
  size = 'md',
  dimmed = false,
}: {
  card: Card;
  size?: CardSize;
  dimmed?: boolean;
}) {
  const suit = card[0];
  const rank = formatRank(card.slice(1));
  const color = RED_SUITS.has(suit) ? colors.red600 : colors.zinc900;
  const s = SIZE[size];

  return (
    <View
      style={[
        styles.card,
        { height: s.h, width: s.w, borderRadius: s.r },
        dimmed && { opacity: 0.35 },
      ]}
    >
      <View>
        <Text style={[styles.cornerText, { color, fontSize: s.corner }]}>{rank}</Text>
        <Text style={[styles.cornerText, { color, fontSize: s.corner, marginTop: -2 }]}>
          {SUIT_SYMBOL[suit]}
        </Text>
      </View>
      <View style={styles.centerWrap} pointerEvents="none">
        <Text style={{ color, fontSize: s.center, fontWeight: '700' }}>{SUIT_SYMBOL[suit]}</Text>
      </View>
      <View style={styles.bottomCorner}>
        <Text style={[styles.cornerText, { color, fontSize: s.corner }]}>{rank}</Text>
        <Text style={[styles.cornerText, { color, fontSize: s.corner, marginTop: -2 }]}>
          {SUIT_SYMBOL[suit]}
        </Text>
      </View>
    </View>
  );
}

/**
 * カード裏面。純粋な装飾で、カード情報は一切持たない(手札漏洩防止のため
 * 実際の Card 値を受け取らない設計にしている)。
 */
export function CardBack({ size = 'md' }: { size?: CardSize }) {
  const s = SIZE[size];
  return (
    <LinearGradient
      colors={gradients.cardBack}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.back, { height: s.h, width: s.w, borderRadius: s.r }]}
    >
      <View style={styles.backInner}>
        <Text style={styles.backSuit}>♠</Text>
      </View>
    </LinearGradient>
  );
}

/** コミュニティカードの空きスロット */
export function CardSlot({ size = 'md' }: { size?: CardSize }) {
  const s = SIZE[size];
  return <View style={[styles.slot, { height: s.h, width: s.w, borderRadius: s.r }]} />;
}

/** チップ額の表示(色付きトークン+数字) */
export function ChipAmount({
  amount,
  color = colors.foreground,
  fontSize = 14,
}: {
  amount: number;
  color?: string;
  fontSize?: number;
}) {
  return (
    <View style={styles.chipRow}>
      <View style={styles.chipToken} />
      <Text style={[styles.chipText, { color, fontSize }]}>{amount.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    padding: 4,
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  cornerText: { fontWeight: '700', lineHeight: undefined },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCorner: { transform: [{ rotate: '180deg' }] },
  back: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  backInner: {
    height: '70%',
    width: '65%',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.4)',
    backgroundColor: '#172554',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backSuit: { fontSize: 10, color: 'rgba(147,197,253,0.7)' },
  slot: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipToken: {
    height: 16,
    width: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: colors.rose600,
  },
  chipText: { fontWeight: '600', fontVariant: ['tabular-nums'] },
});
