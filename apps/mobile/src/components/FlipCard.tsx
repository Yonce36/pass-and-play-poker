import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
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
 *
 * 実装メモ:
 * - 回転中は overflow:'hidden' で隣へはみ出す描画を防ぐ
 * - 90°前後で裏/表を切り替える(Android の backface 差異回避)
 * - 完了後は Animated を捨てて通常の CardView のみにする
 *   (半透明レイヤーが残って画面左が灰色に見える事象の対策)
 */
export function FlipCard({
  card,
  size = 'md',
  delay = 0,
  duration = 450,
}: {
  card: Card;
  size?: CardSize;
  delay?: number;
  duration?: number;
}) {
  const s = CARD_SIZE[size];
  const rotation = useSharedValue(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    rotation.value = withDelay(
      delay,
      withTiming(180, { duration, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setDone)(true);
      }),
    );
    // マウント時に一度だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backStyle = useAnimatedStyle(() => ({
    // 厳密に二分し、両方 0.5 などで重なって灰色に濁るのを防ぐ
    opacity: rotation.value < 90 ? 1 : 0,
    transform: [{ perspective: 800 }, { rotateY: `${rotation.value}deg` }],
  }));
  const faceStyle = useAnimatedStyle(() => ({
    opacity: rotation.value < 90 ? 0 : 1,
    transform: [{ perspective: 800 }, { rotateY: `${rotation.value - 180}deg` }],
  }));

  // フリップ完了後は静的カードのみ(オーバーレイ・半透明レイヤーを残さない)
  if (done) {
    return <CardView card={card} size={size} />;
  }

  return (
    <View style={{ height: s.h, width: s.w, overflow: 'hidden' }}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, faceStyle]}
      >
        <CardView card={card} size={size} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, backStyle]}
      >
        <CardBack size={size} />
      </Animated.View>
    </View>
  );
}
