# Pass & Play Poker — 仕様書 SPEC.md（v3 確定版）

本書がゲームルール・データモデルの単一の真実。CLAUDE.md・STATE_MACHINE.md とセットで参照する。
外部AIレビューおよび確定判断をすべて統合済み。本書と過去のレビュー依頼MDが矛盾する場合、本書が優先。

---

## 1. プロダクト概要

- 1台のスマホを手渡し（パス＆プレイ）して遊ぶ、完全オフラインのテキサスホールデムPWA
- 想定シーン: 新幹線・飲み会・旅行など、2〜6人の小規模グループ
- 初期版: 無料・広告なし・**2人専用**・PWA・サーバー/DB/認証なし
- 将来: 買い切りで 3〜6人・ブラインド上昇・履歴UI・テーマ等を解放
- core ロジックは最初から 2〜6人対応で設計し、UIのみ2人に絞る

## 2. 確定済みプロダクト判断

| 項目 | 決定 |
|---|---|
| バースト | チップ0で退場（busted）。リバイなし。2人版は相手バーストで終局・勝敗表示 |
| ブラインド | ハンド中・セッション中ともに固定。上昇機能は有料版候補 |
| アンドゥ | なし。アクション確定後の取り消し不可 |
| 初期値 | 設定画面で変更可。デフォルト chips=1000 / SB=10 / BB=20 |
| 設定バリデーション | BB > SB、startingChips > BB、すべて正整数 |
| 対応端末 | iPhone主要。最小幅375px（iPhone SE級） |
| タイマー | 初期デフォルトOFF。ON時は15/30/60秒等から選択 |
| odd chip | ボタンから時計回りで最初の eligible プレイヤーへ |
| short all-in | フルレイズ未満のオールインはアクションを reopen しない |
| ActionLog | 実装するがUI非表示・persist対象外（デバッグ/検証用） |
| iOSアプリスイッチャー | サムネイル制御は技術的に不可能。運用（見たらすぐ伏せる）で割り切る |

## 3. データモデル

### 3.1 カード

```ts
type Suit = 'H' | 'D' | 'C' | 'S';
type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'T'|'J'|'Q'|'K'|'A'; // 10は'T'
type Card = `${Suit}${Rank}`;
```

### 3.2 フェーズ（進行状態の単一の真実）

```ts
type GamePhase =
  | 'setup'
  | 'postingBlinds'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'handComplete'
  | 'gameOver';        // 2人版: 一方がbustedで到達
```

street の二重管理は禁止。BettingState に street を持たせない。

### 3.3 プレイヤー

```ts
interface Player {
  id: string;
  seatIndex: number;
  name: string;
  pin: string | null;          // 任意4桁。平文保持（オフライン割り切り）

  chips: number;
  currentBet: number;          // 現ストリートのベット額
  totalContribution: number;   // 当該ハンド累計拠出（サイドポット計算の入力）
  cards: Card[];

  status: 'active' | 'folded' | 'allIn' | 'busted' | 'sittingOut';

  hasActedThisRound: boolean;  // 現ストリートで能動アクション済みか
  hasOption: boolean;          // 再アクション権（BBオプション含む）。trueの間ラウンド非終了
}
```

`hasOption` の規則:
- プリフロップ開始時、BB のみ true（ブラインドポストはアクションに数えない）
- フルレイズ発生時、レイザー以外の active 全員を true に立て直す
- 自分が check / call / bet / raise / fold したら false
- short all-in ではどのプレイヤーの hasOption も立て直さない

### 3.4 ゲーム設定

```ts
interface GameConfig {
  smallBlind: number;          // default 10
  bigBlind: number;            // default 20
  startingChips: number;       // default 1000
  minPlayers: number;          // 2
  maxPlayers: number;          // 6（UIは初期版2人のみ）
  allowedPlayerCount: 2 | 3 | 4 | 5 | 6;

  timerEnabled: boolean;       // default false
  timerDurationSec: number;
  oddChipRule: 'clockwiseFromButton';  // 固定値だが明示
}
```

### 3.5 ベッティング状態

```ts
interface BettingState {
  actingOrder: string[];           // 現ストリートの行動順（playerId）。次手番の決定的導出に使う
  currentMaxBet: number;
  minRaiseTo: number;              // 次の合法レイズの最低到達額
  lastFullRaiseAmount: number;     // 直近フルレイズの増分
  lastAggressorPlayerId: string | null;
  firstActorPlayerId: string | null;
}
```

actingOrder の構築:
- preflop: BBの左隣から時計回り。**ヘッズアップは SB(=ボタン) から**
- postflop: ボタンの左隣から時計回り。**ヘッズアップは BB から**
- folded / allIn / busted / sittingOut は手番取得時にスキップ

### 3.6 ポット

```ts
interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
  sourceContributionLevel?: number;
}
```

### 3.7 アクションログ

```ts
interface ActionLog {
  id: string;
  handNumber: number;
  street: GamePhase;
  playerId: string;
  action: 'blind'|'check'|'call'|'bet'|'raise'|'fold'|'allIn'|'timeout';
  amount: number;
  resultingBet: number;
  timestamp: number;
}
```

UI非表示・persist対象外。

### 3.8 ハンドオフ状態

```ts
type HandoffStep = 'idle'|'confirm1'|'confirm2'|'pinEntry'|'reveal'|'locked';

interface HandoffState {
  step: HandoffStep;
  targetPlayerId: string | null;        // これから見る人
  currentViewerPlayerId: string | null; // 今見ている人
  pinAttempts: number;
}
```

原則（leak-auditor の監査対象）:
- 手札は `step === 'reveal'` のときのみ DOM に出力（条件付きレンダリング。CSS隠しは禁止）
- visibilitychange / blur / pagehide / 復元時は必ず locked
- ブラウザバックで reveal に戻れないこと（history制御）
- reveal 状態は persist しない

フロー:
- PINなし: idle → confirm1（あなたは○○さん?）→ confirm2（本当に? 一方向スワイプ）→ reveal
- PINあり: idle → pinEntry（4桁一致）→ reveal

### 3.9 タイマー

```ts
interface TimerState {
  enabled: boolean;
  durationSec: number;
  remainingSec: number;
  timeoutAction: 'autoCheckOrFold' | 'foldOnly';
  isPaused: boolean;
}
```

ハンドオフ中（reveal以外）は停止。reveal完了後にカウント開始。

### 3.10 ショーダウン結果

```ts
interface HandResult {
  playerId: string;
  handRank: 'highCard'|'onePair'|'twoPair'|'threeOfAKind'|'straight'
          | 'flush'|'fullHouse'|'fourOfAKind'|'straightFlush';
  bestFiveCards: Card[];
  score: number[];   // [役の強さ, 主ランク..., キッカー...] 辞書順比較。bigint不使用
}
```

wheel straight (A2345) は 5-high として比較（Aは最弱扱い）。

### 3.11 GameState（ルート）

```ts
interface GameState {
  handNumber: number;
  phase: GamePhase;
  config: GameConfig;
  players: Player[];
  activePlayerId: string | null;
  dealerButtonPlayerId: string | null;
  betting: BettingState;
  pots: Pot[];
  communityCards: Card[];
  deck: Card[];                // 平文。オフライン割り切り
  handoff: HandoffState;
  timer: TimerState;
  actionLog: ActionLog[];
}
```

## 4. ゲームルール仕様

### 4.1 ブラインドとヘッズアップ

- ボタン側がSB、非ボタン側がBB（2人時）
- プリフロップ: SB(ボタン)が先に行動 / フロップ以降: BBが先
- ブラインドポストは「アクション」に数えない（hasActedThisRound は false のまま）

### 4.2 ベッティングラウンド終了条件

active（folded/allIn/busted/sittingOutでない）全員が
`hasActedThisRound === true && hasOption === false && currentBet === currentMaxBet`
を満たしたとき終了。

- BBオプション: 全員コールで額が揃っても BB の hasOption が true の間は非終了
- フルレイズ: レイザー以外の active 全員の hasActedThisRound=false / hasOption=true に立て直す
- short all-in: 立て直しなし（reopen しない）。額が currentMaxBet を超えていても同様

### 4.3 最小レイズ

- minRaiseTo = currentMaxBet + lastFullRaiseAmount
- 合法レイズは minRaiseTo 以上、または all-in（額不問。ただし short ならreopenなし）

### 4.4 サイドポット生成（ハンド終了時に一括）

1. 全プレイヤー（foldedを含む）の totalContribution を集計
2. 拠出額のユニーク値を昇順ソート
3. レベルごとにレイヤーを切り出し: amount = そのレベル以上を拠出した人数 × 差分
4. eligible = そのレベル以上を拠出し、かつ folded でないプレイヤー
5. folded のチップはポットに入るが eligible には入らない

### 4.5 分配

- ポットごとに eligible のみで HandResult を比較
- 同点はチョップ。割り切れない端数はボタンから時計回りで最初の eligible へ
- fold勝ち（active が1人）: showdown を経ず即 handComplete、その1人が全ポット獲得
- 全員 all-in: 残りストリートをベッティングなしで自動公開し showdown へ直行

### 4.6 ハンド完了とリセット

handComplete で次をリセットして postingBlinds へ:
currentBet / totalContribution / hasActedThisRound / hasOption / cards /
pots / communityCards / deck（再生成）/ betting一式 / ボタン移動

chips=0 のプレイヤーは busted。残り1人なら gameOver（勝敗表示）。

## 5. persist 方針

- zustand persist + localStorage。partialize で対象を制御
- 保存する: players（cards/pin含む。割り切り）/ deck / communityCards / phase / betting / pots / config / handNumber
- 保存しない: handoff の reveal 状態 / actionLog / timer.remainingSec
- 復元時: handoff.step を強制 'locked'、timer は停止状態で復元

## 6. PWA 方針

- 候補: @serwist/next を第一候補に検証 → 問題があれば @ducanh2912/next-pwa → 自前SW
- Phase 7 完了時点で一度実機検証（standalone表示 / 復帰locked / history制御 / セーフエリア）
- iOS制約（アプリスイッチャーのサムネイル）は防御不可と割り切り、READMEに注意書き

## 7. テスト必須ケース一覧（test-guardian の基準）

- deck: 52枚 / 重複なし / 注入乱数で再現可能
- handEval: 全9役 / wheel / kicker比較 / ボードのみチョップ / 同役比較
- betting: heads-up preflop順 / BBオプション / 全員チェック / bet-call /
  raise後の義務リセット / short all-in非reopen / fold勝ち / 全員all-in自動進行 /
  次ストリートのリセット / minRaiseTo更新
- sidePot/showdown: 2人all-in / 3人all-in / folded拠出 / 複数サイドポット /
  メインとサイドで勝者相違 / チョップ / odd chip
- config: バリデーション3条件
- ※ sidePot のテスト入力は betting エンジンの実出力を使う（人工値を避ける）
