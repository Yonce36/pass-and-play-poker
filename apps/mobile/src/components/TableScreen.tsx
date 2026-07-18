import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { Player } from '@pass-and-play/core';
import { useGameStore } from '../store';
import { colors, gradients } from '../theme';
import { CardBack, CardSlot, CardView, ChipAmount } from './CardView';
import { HandoffFlow } from './HandoffFlow';
import { TurnGlow } from './TurnGlow';

type Point = { x: number; y: number };

/**
 * ベット確定時に席からポットへ飛ぶチップ(M3-B。純装飾)。
 * 金額情報は持たず、座標はレイアウト計測値のみ。飛び終わると親が破棄する。
 */
function FlyingChip({ from, to, delay }: { from: Point; to: Point; delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 480, easing: Easing.in(Easing.quad) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.9 ? 1 : (1 - p.value) * 10,
    transform: [
      { translateX: from.x + (to.x - from.x) * p.value },
      { translateY: from.y + (to.y - from.y) * p.value },
      { scale: 1 - 0.25 * p.value },
    ],
  }));
  return <Animated.View style={[styles.flyingChip, style]} />;
}

const STREET_LABEL: Record<string, string> = {
  postingBlinds: 'ブラインド',
  preflop: 'プリフロップ',
  flop: 'フロップ',
  turn: 'ターン',
  river: 'リバー',
  showdown: 'ショーダウン',
};

/** Seat に渡す表示用情報。cards を props に流さない(STATE_MACHINE 4 不変条件) */
type SeatPlayer = Pick<Player, 'id' | 'name' | 'chips' | 'currentBet' | 'status'> & {
  hasCards: boolean;
};

const toSeatPlayer = (p: Player): SeatPlayer => ({
  id: p.id,
  name: p.name,
  chips: p.chips,
  currentBet: p.currentBet,
  status: p.status,
  hasCards: p.cards.length > 0,
});

/** 1プレイヤー分の席(アバター・チップ・カード裏・ベット・ステータス) */
function Seat({
  player,
  isActive,
  isButton,
}: {
  player: SeatPlayer;
  isActive: boolean;
  isButton: boolean;
}) {
  const inHand = player.status === 'active' || player.status === 'allIn';
  const folded = player.status === 'folded';

  return (
    <View style={[styles.seat, isActive && styles.seatActive, folded && { opacity: 0.5 }]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{player.name.charAt(0)}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>
            {player.name}
          </Text>
          {isButton && (
            <View style={styles.dealerButton}>
              <Text style={styles.dealerButtonText}>D</Text>
            </View>
          )}
        </View>
        <ChipAmount amount={player.chips} color={colors.zinc300} />
      </View>

      <View style={styles.seatRight}>
        {player.status === 'allIn' && (
          <View style={[styles.badge, { backgroundColor: colors.rose600 }]}>
            <Text style={styles.badgeText}>ALL-IN</Text>
          </View>
        )}
        {folded && (
          <View style={[styles.badge, { backgroundColor: colors.zinc700 }]}>
            <Text style={styles.badgeText}>フォールド</Text>
          </View>
        )}
        {player.currentBet > 0 && (
          <ChipAmount amount={player.currentBet} color={colors.amber300} fontSize={12} />
        )}
        {inHand && player.hasCards && (
          <View style={{ flexDirection: 'row' }}>
            <View style={{ marginRight: -16 }}>
              <CardBack size="sm" />
            </View>
            <CardBack size="sm" />
          </View>
        )}
      </View>

      {isActive && <TurnGlow borderRadius={16} />}
      {isActive && (
        <View style={styles.turnBadge}>
          <Text style={styles.turnBadgeText}>手番</Text>
        </View>
      )}
    </View>
  );
}

export function TableScreen() {
  const players = useGameStore((s) => s.players);
  const communityCards = useGameStore((s) => s.communityCards);
  const activePlayerId = useGameStore((s) => s.activePlayerId);
  const dealerButtonPlayerId = useGameStore((s) => s.dealerButtonPlayerId);
  const phase = useGameStore((s) => s.phase);
  const handNumber = useGameStore((s) => s.handNumber);

  const bySeat = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const [heroSeat, ...otherSeats] = bySeat;
  const activePlayer = players.find((p) => p.id === activePlayerId);

  const totalContribution = players.reduce((sum, p) => sum + p.totalContribution, 0);
  const currentBets = players.reduce((sum, p) => sum + p.currentBet, 0);
  // 「ポット」は回収済み分。現ストリートのベットは各席の前に表示する
  const potCollected = totalContribution - currentBets;

  // ===== チップ飛翔(M3-B): currentBet の増加を検知して席→ポットへ飛ばす =====
  const [flights, setFlights] = useState<
    { id: number; from: Point; to: Point; delay: number }[]
  >([]);
  const layoutRef = useRef<{ seats: Record<string, Point>; pot: Point | null }>({
    seats: {},
    pot: null,
  });
  const prevBetsRef = useRef<Record<string, number> | null>(null);
  const flightIdRef = useRef(0);

  useEffect(() => {
    const prev = prevBetsRef.current;
    const next: Record<string, number> = {};
    for (const p of players) next[p.id] = p.currentBet;
    // 初回(マウント/復元直後)は記録のみで発火しない
    if (prev) {
      const spawned: { id: number; from: Point; to: Point; delay: number }[] = [];
      for (const p of players) {
        const from = layoutRef.current.seats[p.id];
        const to = layoutRef.current.pot;
        if (from && to && p.currentBet > (prev[p.id] ?? 0)) {
          for (let i = 0; i < 3; i++) {
            spawned.push({ id: flightIdRef.current++, from, to, delay: i * 70 });
          }
        }
      }
      if (spawned.length > 0) {
        setFlights((f) => [...f, ...spawned]);
        const ids = new Set(spawned.map((s) => s.id));
        setTimeout(() => setFlights((f) => f.filter((fl) => !ids.has(fl.id))), 900);
      }
    }
    prevBetsRef.current = next;
  }, [players]);

  const onSeatLayout = (playerId: string) => (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    layoutRef.current.seats[playerId] = { x: x + width / 2, y: y + height / 2 };
  };
  const onFeltLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    layoutRef.current.pot = { x: x + width / 2, y: y + height / 2 };
  };

  return (
    <View style={styles.container}>
      {/* 相手側の席(将来の3人以上にも対応)。onLayout はコンテナ直下でチップ飛翔の座標を取る */}
      {otherSeats.map((p) => (
        <View key={p.id} onLayout={onSeatLayout(p.id)}>
          <Seat
            player={toSeatPlayer(p)}
            isActive={p.id === activePlayerId}
            isButton={p.id === dealerButtonPlayerId}
          />
        </View>
      ))}

      {/* テーブル(フェルト。左上から照明が当たる緑ラシャのグラデーション) */}
      <LinearGradient
        colors={gradients.felt}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.felt}
        onLayout={onFeltLayout}
      >
        <Text style={styles.feltLabel}>
          第{handNumber}ハンド ・ {STREET_LABEL[phase] ?? phase}
        </Text>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          {communityCards.map((c) => (
            <CardView key={c} card={c} size="sm" />
          ))}
          {Array.from({ length: 5 - communityCards.length }).map((_, i) => (
            <CardSlot key={`slot-${i}`} size="sm" />
          ))}
        </View>

        <View style={styles.potPill}>
          <Text style={styles.potLabel}>ポット </Text>
          <ChipAmount amount={potCollected} color={colors.emerald100} />
        </View>
      </LinearGradient>

      {/* 自分側(seatIndex最小)の席 */}
      {heroSeat && (
        <View onLayout={onSeatLayout(heroSeat.id)}>
          <Seat
            player={toSeatPlayer(heroSeat)}
            isActive={heroSeat.id === activePlayerId}
            isButton={heroSeat.id === dealerButtonPlayerId}
          />
        </View>
      )}

      {/* チップ飛翔のオーバーレイ(タッチ透過・情報なし) */}
      {flights.length > 0 && (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          {flights.map((f) => (
            <FlyingChip key={f.id} from={f.from} to={f.to} delay={f.delay} />
          ))}
        </View>
      )}

      {/* cards を含む Player を props に流さない(STATE_MACHINE 4 不変条件) */}
      {activePlayer && (
        <HandoffFlow activePlayer={{ id: activePlayer.id, name: activePlayer.name }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12, padding: 12 },
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: 'rgba(24,24,27,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  seatActive: { borderColor: colors.gold },
  avatar: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: colors.zinc700,
    borderWidth: 2,
    borderColor: colors.white20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontWeight: '600', color: colors.foreground, flexShrink: 1 },
  dealerButton: {
    height: 20,
    width: 20,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealerButtonText: { fontSize: 10, fontWeight: '900', color: colors.zinc900 },
  seatRight: { alignItems: 'flex-end', gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#ffffff', letterSpacing: 1 },
  turnBadge: {
    position: 'absolute',
    top: -10,
    left: 16,
    borderRadius: 999,
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  turnBadgeText: { fontSize: 10, fontWeight: '700', color: colors.zinc900 },
  felt: {
    alignItems: 'center',
    gap: 12,
    borderRadius: 40,
    borderWidth: 6,
    borderColor: colors.rail,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  feltLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2,
    color: 'rgba(209,250,229,0.6)',
  },
  potPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  potLabel: { fontSize: 14, color: 'rgba(167,243,208,0.7)' },
  flyingChip: {
    position: 'absolute',
    top: -8,
    left: -8,
    height: 16,
    width: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: colors.rose600,
  },
});
