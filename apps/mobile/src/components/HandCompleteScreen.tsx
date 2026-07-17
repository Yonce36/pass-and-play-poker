import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { selectHandCompleteView, useGameStore } from '../store';
import { colors } from '../theme';
import { CardSlot, CardView, ChipAmount } from './CardView';

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

/**
 * ハンド終了画面(Web版の 1:1 移植)。showdown/fold勝ちの判定と分配額の導出は
 * selectHandCompleteView に集約(コンポーネントにゲームロジックを書かない)。
 * fold勝ちでは cards が null で返るため手札は描画されない(STATE_MACHINE 3)。
 * all-in ランアウト(runOutFrom !== null)では、手札を先に公開したうえでボードを
 * ストリートごとに時間差でめくり、勝敗情報はめくり終わるまで表示しない。
 */
export function HandCompleteScreen({
  onNext,
  nextLabel = '次のハンドへ',
}: {
  onNext?: () => void;
  nextLabel?: string;
}) {
  const state = useGameStore();
  const startNextHand = useGameStore((s) => s.startNextHand);
  const view = selectHandCompleteView(state);

  const runOutFrom = view.isShowdown ? state.runOutFrom : null;
  const [revealedCount, setRevealedCount] = useState(runOutFrom ?? 5);
  useEffect(() => {
    if (revealedCount >= 5) return;
    // フロップは3枚同時、以降は1枚ずつ(endStreet のストリート単位公開と同じ刻み)
    const timer = setTimeout(() => setRevealedCount((n) => (n < 3 ? 3 : n + 1)), 1100);
    return () => clearTimeout(timer);
  }, [revealedCount]);
  const done = revealedCount >= 5;

  const winners = view.entries.filter((e) => e.amount > 0);
  const winnerLabel = winners.map((w) => w.name).join(' / ');
  const isChop = winners.length > 1;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 勝者バナー(ランアウト完了まで伏せる) */}
      {done ? (
        <View style={styles.banner}>
          <Text style={[styles.bannerLabel, { color: colors.gold }]}>
            {isChop ? 'チョップ' : 'WINNER'}
          </Text>
          <Text style={styles.bannerName}>{winnerLabel}</Text>
          <ChipAmount
            amount={winners.reduce((s, w) => s + w.amount, 0)}
            color={colors.gold}
            fontSize={20}
          />
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
        <View style={styles.board}>
          <Text style={styles.boardLabel}>ボード</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {state.communityCards.slice(0, revealedCount).map((c) => (
              <CardView key={c} card={c} size="sm" />
            ))}
            {Array.from({ length: 5 - revealedCount }).map((_, i) => (
              <CardSlot key={`slot-${i}`} size="sm" />
            ))}
          </View>
        </View>
      )}

      <View style={styles.entries}>
        {view.entries.map((entry) => {
          const won = done && entry.amount > 0;
          const best = new Set(entry.bestFiveCards ?? []);
          return (
            <View key={entry.playerId} style={[styles.entry, won && styles.entryWon]}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryName}>{entry.name}</Text>
                {won && <ChipAmount amount={entry.amount} color={colors.gold} />}
              </View>
              {entry.cards && entry.handRank ? (
                <View style={styles.entryCards}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {entry.cards.map((c) => (
                      <CardView key={c} card={c} size="sm" dimmed={done && !best.has(c)} />
                    ))}
                  </View>
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
          onPress={onNext ?? (() => startNextHand())}
          style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
        >
          <Text style={styles.nextButtonText}>{nextLabel}</Text>
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
    backgroundColor: colors.felt,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  boardLabel: { fontSize: 10, letterSpacing: 2, color: 'rgba(209,250,229,0.6)' },
  entries: { width: '100%', maxWidth: 384, gap: 12 },
  entry: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: 'rgba(24,24,27,0.85)',
    padding: 16,
    gap: 8,
  },
  entryWon: { borderColor: 'rgba(251,191,36,0.6)', backgroundColor: 'rgba(69,26,3,0.3)' },
  entryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryName: { fontWeight: '700', color: colors.foreground },
  entryCards: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankBadge: {
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
});
