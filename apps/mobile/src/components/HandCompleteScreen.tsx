import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { selectHandCompleteView, useGameStore } from '../store';
import { haptics } from '../haptics';
import { colors, gradients } from '../theme';
import { CardSlot, CardView, ChipAmount } from './CardView';
import { FlipCard } from './FlipCard';
import { GameOverScreen } from './GameOverScreen';

const RANK_LABEL: Record<string, string> = {
  highCard: 'ハイカード',
  onePair: 'ワンペア',
  twoPair: 'ツーペア',
  threeOfAKind: 'スリーカード',
  straight: 'ストレート',
  flush: 'フラッシュ',
  fullHouse: 'フルハウス',
  fourOfAKind: 'フォーカード',
  straightFlush: 'ストレートフラッシュ',
};

/** 勝者行に降り注ぐチップバースト(純装飾。M3-B: 勝者へのチップ吸い込み) */
function ChipBurst() {
  const offsets = [-70, -25, 20, 65, -48, 42];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {offsets.map((x, i) => (
        <BurstChip key={i} offsetX={x} delay={i * 80} />
      ))}
    </View>
  );
}

function BurstChip({ offsetX, delay }: { offsetX: number; delay: number }) {
  // 0→1: 上から勝者行へ落下、1→1.4: 着地後にフェードアウト
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 480, easing: Easing.in(Easing.quad) }),
        withTiming(1.4, { duration: 320 }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => {
    const fly = Math.min(p.value, 1);
    return {
      opacity: p.value <= 1 ? Math.min(fly * 5, 1) : 1.4 - p.value < 0.4 ? (1.4 - p.value) * 2.5 : 1,
      transform: [
        { translateY: -170 * (1 - fly) },
        { translateX: offsetX * (1 - fly) },
        { rotate: `${(1 - fly) * 200}deg` },
      ],
    };
  });
  return (
    <View style={styles.burstAnchor}>
      <Animated.View style={[styles.burstChip, style]} />
    </View>
  );
}

/**
 * ハンド終了画面(Web版の 1:1 移植)。showdown/fold勝ちの判定と分配額の導出は
 * selectHandCompleteView に集約(コンポーネントにゲームロジックを書かない)。
 * fold勝ちでは cards が null で返るため手札は描画されない(STATE_MACHINE 3)。
 * all-in ランアウト(runOutFrom !== null)では、手札を先に公開したうえでボードを
 * ストリートごとに時間差でめくり、勝敗情報はめくり終わるまで表示しない。
 * gameOver 直行時は phase から導出し、最終ハンドのあと内部で GameOverScreen へ進む。
 *
 * showdown 確定後は文字説明なしで、ベスト5=金枠・未使用=減光、役名バッジのみ。
 */
export function HandCompleteScreen() {
  const state = useGameStore();
  const startNextHand = useGameStore((s) => s.startNextHand);
  const isGameOver = state.phase === 'gameOver';
  const [finalHandSeen, setFinalHandSeen] = useState(false);
  const view = selectHandCompleteView(state);

  const runOutFrom = view.isShowdown ? state.runOutFrom : null;
  const [revealedCount, setRevealedCount] = useState(runOutFrom ?? 5);
  useEffect(() => {
    if (revealedCount >= 5) return;
    // フロップは3枚同時、以降は1枚ずつ(endStreet のストリート単位公開と同じ刻み)。
    // 勝負決定札のリバー(5枚目)の直前だけ通常1100msに+600msの「タメ」を挟む(M3-B)
    const isRiverNext = revealedCount === 4;
    const timer = setTimeout(
      () => {
        if (isRiverNext) haptics.reveal();
        else haptics.flip();
        setRevealedCount((n) => (n < 3 ? 3 : n + 1));
      },
      isRiverNext ? 1700 : 1100,
    );
    return () => clearTimeout(timer);
  }, [revealedCount]);
  const done = revealedCount >= 5;

  // 勝敗確定の祝祭触覚(ランアウトのめくり終わり、または画面表示の瞬間)
  useEffect(() => {
    if (done) haptics.win();
  }, [done]);

  // バナーは役スコア(キッカー込み)の勝者。amount>0 だとサイドポット返却も混ざり誤チョップになる
  const handWinners = view.entries.filter((e) => e.isHandWinner);
  const winnerLabel = handWinners.map((w) => w.name).join(' / ');
  const isChop = view.isChop;
  const bannerAmount = isChop
    ? handWinners.reduce((s, w) => s + w.amount, 0)
    : (handWinners[0]?.amount ?? view.entries.filter((e) => e.amount > 0).reduce((s, w) => s + w.amount, 0));

  // hooks の後で分岐(rules-of-hooks)
  if (isGameOver && finalHandSeen) {
    return <GameOverScreen />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 勝者バナー(ランアウト完了まで伏せる) */}
      {done ? (
        <View style={styles.banner}>
          <Text style={[styles.bannerLabel, { color: colors.gold }]}>
            {isChop ? 'チョップ' : 'WINNER'}
          </Text>
          <Text style={styles.bannerName}>{winnerLabel}</Text>
          <ChipAmount amount={bannerAmount} color={colors.gold} fontSize={20} />
        </View>
      ) : (
        <View style={styles.banner}>
          <Text style={[styles.bannerLabel, { color: colors.rose600 }]}>ALL IN</Text>
          <Text style={styles.bannerName}>ショーダウン</Text>
          <ChipAmount amount={view.potTotal} color={colors.zinc300} fontSize={20} />
        </View>
      )}

      {/* コミュニティカード(showdown時のみ意味がある) */}
      {view.isShowdown && (
        <LinearGradient
          colors={gradients.felt}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.board}
        >
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {state.communityCards.slice(0, revealedCount).map((c, i) =>
              runOutFrom !== null && i >= runOutFrom ? (
                // ランアウトで公開された分は裏→表の3Dフリップ。フロップは3枚が連続でめくれ、
                // リバー(5枚目)はゆっくりドラマチックにめくる
                // stagger はマウント時のバッチ(フロップ=3枚/ターン・リバー=1枚)内の相対位置。
                // マウント済みカードは delay が変わっても再アニメーションしない
                <FlipCard
                  key={c}
                  card={c}
                  size="sm"
                  delay={Math.max(0, i - (revealedCount === 3 ? runOutFrom : revealedCount - 1)) * 150}
                  duration={i === 4 ? 700 : 420}
                />
              ) : (
                <CardView key={c} card={c} size="sm" />
              ),
            )}
            {Array.from({ length: 5 - revealedCount }).map((_, i) => (
              <CardSlot key={`slot-${i}`} size="sm" />
            ))}
          </View>
        </LinearGradient>
      )}

      <View style={styles.entries}>
        {view.entries.map((entry) => {
          const won = done && entry.isHandWinner;
          const best = new Set(entry.bestFiveCards ?? []);
          return (
            <View key={entry.playerId} style={[styles.entry, won && styles.entryWon]}>
              {won && <ChipBurst />}
              <View style={styles.entryHeader}>
                <Text style={styles.entryName}>{entry.name}</Text>
                {done && entry.amount > 0 && (
                  <ChipAmount amount={entry.amount} color={won ? colors.gold : colors.zinc300} />
                )}
              </View>
              {entry.cards && entry.handRank ? (
                <View style={styles.entryBody}>
                  {/* 手札 → ボード。金枠=使用 / 減光=未使用。説明文は出さない */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {entry.cards.map((c) => (
                      <CardView
                        key={c}
                        card={c}
                        size="sm"
                        highlighted={done && best.has(c)}
                        dimmed={done && !best.has(c)}
                      />
                    ))}
                  </View>
                  {done && (
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {state.communityCards.map((c) => (
                        <CardView
                          key={`board-${entry.playerId}-${c}`}
                          card={c}
                          size="sm"
                          highlighted={best.has(c)}
                          dimmed={!best.has(c)}
                        />
                      ))}
                    </View>
                  )}
                  {done && (
                    <View style={[styles.rankBadge, won && { backgroundColor: colors.gold }]}>
                      <Text style={[styles.rankBadgeText, won && { color: colors.zinc900 }]}>
                        {RANK_LABEL[entry.handRank]}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.hiddenText}>手札は非公開です</Text>
              )}
            </View>
          );
        })}
      </View>

      {done && (
        <Pressable
          onPress={() => (isGameOver ? setFinalHandSeen(true) : startNextHand())}
          style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
        >
          <Text style={styles.nextButtonText}>{isGameOver ? '最終結果へ' : '次のハンドへ'}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', gap: 20, padding: 20 },
  banner: { marginTop: 16, alignItems: 'center', gap: 4 },
  bannerLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 4 },
  bannerName: { fontSize: 30, fontWeight: '900', color: colors.foreground },
  board: {
    alignItems: 'center',
    gap: 8,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: colors.rail,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  entries: { width: '100%', maxWidth: 384, gap: 12 },
  entry: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: 'rgba(24,24,27,0.85)',
    padding: 16,
    gap: 8,
    overflow: 'hidden', // ChipBurst のはみ出しで左端が濁るのを防ぐ
  },
  entryWon: { borderColor: 'rgba(251,191,36,0.6)', backgroundColor: 'rgba(69,26,3,0.3)' },
  entryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryName: { fontWeight: '700', color: colors.foreground },
  entryBody: { gap: 10 },
  rankBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: colors.zinc800,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  rankBadgeText: { fontSize: 12, fontWeight: '700', color: colors.zinc300 },
  hiddenText: { fontSize: 12, color: colors.zinc500 },
  nextButton: {
    marginTop: 'auto',
    width: '100%',
    maxWidth: 384,
    borderRadius: 999,
    backgroundColor: colors.emerald600,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  burstAnchor: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstChip: {
    height: 16,
    width: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: colors.gold,
  },
});
