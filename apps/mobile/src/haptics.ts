import * as Haptics from 'expo-haptics';

// 触覚フィードバックの割り当てを一箇所に集約する(poker_experience_improvement.md M3-A)。
// 「手渡しは重く・選択はカリッと・オールインは劇的に」など、実機の感触を見て
// この表だけを差し替えれば全画面に反映される。失敗は握りつぶす(非対応端末で無害)
const impact = (style: Haptics.ImpactFeedbackStyle) => {
  Haptics.impactAsync(style).catch(() => {});
};
const notify = (type: Haptics.NotificationFeedbackType) => {
  Haptics.notificationAsync(type).catch(() => {});
};

export const haptics = {
  /** ステッパー・プリセット・軽い選択操作(カリカリ感) */
  tick: () => {
    Haptics.selectionAsync().catch(() => {});
  },
  /** 端末の受け取り(バトンタッチのカチッという重厚な確定) */
  receive: () => impact(Haptics.ImpactFeedbackStyle.Medium),
  /** 軽いボタン(チェック/フォールド/本人確認) */
  light: () => impact(Haptics.ImpactFeedbackStyle.Light),
  /** アクション確定(コール/ベット/レイズ) */
  confirm: () => impact(Haptics.ImpactFeedbackStyle.Medium),
  /** 手札オープンの瞬間 */
  reveal: () => impact(Haptics.ImpactFeedbackStyle.Medium),
  /** オールイン(重い一撃 → 一拍おいて警告の二段構え) */
  allIn: () => {
    impact(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => notify(Haptics.NotificationFeedbackType.Warning), 140);
  },
  /** ランアウトでボードのカードがめくれる */
  flip: () => impact(Haptics.ImpactFeedbackStyle.Light),
  /** 勝者決定・ゲーム勝利の祝祭 */
  win: () => notify(Haptics.NotificationFeedbackType.Success),
  /** 不正操作・PIN不一致 */
  error: () => notify(Haptics.NotificationFeedbackType.Error),
};
