// Web版 globals.css のテーマ変数・Tailwind パレットに対応するデザイントークン。
// リッチグラフィック導入時はここを差し替える
export const colors = {
  background: '#09090b',
  foreground: '#fafafa',
  felt: '#14532d',
  feltLight: '#166534',
  rail: '#451a03',
  gold: '#fbbf24',
  zinc950: '#09090b',
  zinc900: '#18181b',
  zinc800: '#27272a',
  zinc700: '#3f3f46',
  zinc500: '#71717a',
  zinc400: '#a1a1aa',
  zinc300: '#d4d4d8',
  zinc200: '#e4e4e7',
  emerald600: '#059669',
  emerald700: '#047857',
  emerald100: '#d1fae5',
  sky700: '#0369a1',
  rose600: '#e11d48',
  rose700: '#be123c',
  red600: '#dc2626',
  amber300: '#fcd34d',
  white10: 'rgba(255,255,255,0.1)',
  white20: 'rgba(255,255,255,0.2)',
} as const;

// expo-linear-gradient 用のグラデーション定義(M3-A: 質感向上)。
// 3値タプルは [明るい側, 基調, 影側]
export const gradients = {
  /** 画面全体の背景(上部がわずかに温かく明るい) */
  screen: ['#1c1917', '#0c0a09', '#09090b'] as const,
  /** フェルト(左上に照明が当たる緑ラシャ) */
  felt: ['#1d7a44', '#14532d', '#0d3b1f'] as const,
  /** カード裏面(青の深み) */
  cardBack: ['#2749c4', '#1e3a8a', '#14204f'] as const,
  /** 席・パネルの下地(ごく僅かな立体感) */
  panel: ['#1f1f23', '#18181b'] as const,
} as const;
