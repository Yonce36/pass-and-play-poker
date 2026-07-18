import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { Card } from '@pass-and-play/core';
import { CARD_SIZE, CardBack, CardView, type CardSize } from './CardView';

/**
 * マウント時に裏→表へ3Dフリップするカード(M3-B)。
 * 呼び出し側が「表示してよい公開カード」であることを保証すること。
 * カード値がネイティブツリーに入るのはこのコンポーネントのマウント時
 * (=公開の瞬間)であり、それ以前に値を持たない。
 * Android の backfaceVisibility 差異を避けるため、90度で裏表の不透明度を切り替える。
 */
export function FlipCard({
  card,
  size = 'md',
  delay = 0,
  duration = 450,
  dimmed = false,
}: {
  card: Card;
  size?: CardSize;
  delay?: number;
  duration?: number;
  dimmed?: boolean;
}) {
  const s = CARD_SIZE[size];
  // 0 = 裏向き、180 = 表向き
  const rotation = useSharedValue(0);

  // マウント時に一度だけめくる
  useEffect(() => {
    rotation.value = withDelay(
      delay,
      withTiming(180, { duration, easing: Easing.inOut(Easing.cubic) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backStyle = useAnimatedStyle(() => ({
    opacity: rotation.value < 90 ? 1 : 0,
    transform: [{ perspective: 600 }, { rotateY: `${rotation.value}deg` }],
  }));
  const faceStyle = useAnimatedStyle(() => ({
    opacity: rotation.value >= 90 ? 1 : 0,
    transform: [{ perspective: 600 }, { rotateY: `${rotation.value - 180}deg` }],
  }));

  return (
    <View style={{ height: s.h, width: s.w }}>
      <Animated.View style={[StyleSheet.absoluteFillObject, faceStyle]}>
        <CardView card={card} size={size} dimmed={dimmed} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFillObject, backStyle]}>
        <CardBack size={size} />
      </Animated.View>
    </View>
  );
}
