import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Player } from '@pass-and-play/core';
import { useGameStore } from '../store';
import { colors, gradients } from '../theme';
import { CardBack, CardSlot, CardView, ChipAmount } from './CardView';
import { HandoffFlow } from './HandoffFlow';
import { TurnGlow } from './TurnGlow';

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

  return (
    <View style={styles.container}>
      {/* 相手側の席(将来の3人以上にも対応) */}
      <View style={{ gap: 8 }}>
        {otherSeats.map((p) => (
          <Seat
            key={p.id}
            player={toSeatPlayer(p)}
            isActive={p.id === activePlayerId}
            isButton={p.id === dealerButtonPlayerId}
          />
        ))}
      </View>

      {/* テーブル(フェルト。左上から照明が当たる緑ラシャのグラデーション) */}
      <LinearGradient
        colors={gradients.felt}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.felt}
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
        <Seat
          player={toSeatPlayer(heroSeat)}
          isActive={heroSeat.id === activePlayerId}
          isButton={heroSeat.id === dealerButtonPlayerId}
        />
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
});
