# AI_HANDOFF.md

## 現在のPhaseと完了内容

**Expo移管 Phase M2: Expo アプリ骨組み+全画面 1:1 移植(2026-07-17)**

- `apps/mobile`(@pass-and-play/mobile、Expo SDK 57 / RN 0.86 / blank-typescript)を新設。pnpm workspace に `apps/*` 追加。ナビゲーションライブラリなし(Web版と同じ phase スイッチの単一画面構成)
- 全画面を StyleSheet で 1:1 移植: SetupScreen / TableScreen / ActionPanel(スライダーは @react-native-community/slider)/ HandoffFlow(全ステップ)/ HandCompleteScreen(all-in 段階ランアウト演出含む)/ GameOverScreen(GameOverFlow 含む)/ CardView 一式。アニメーションは意図的に未実装(リッチ化フェーズで Reanimated 予定)
- Web API 置き換え: HandoffGuard → `AppState`(active 以外で lock)+ **expo-screen-capture で常時キャプチャ禁止**(Android FLAG_SECURE)/ storage → AsyncStorage 注入(`apps/mobile/src/store.ts`、core の createGameStore に注入するだけ)/ history 制御 → reveal 中の Android BackHandler(back→lock)
- leak-auditor 指摘対応済み: W-1(expo-screen-capture 導入)/ W-3(AsyncStorage 非同期 hydration 完了まで画面を描画しないゲート。App.tsx)/ I-1(SwipeReveal の revealCards 多重発火ガード)
- 検証: mobile tsc / `expo export --platform ios`(Metro バンドル成功、coreパッケージ解決確認)/ Web側 テスト120件・tsc・build 無影響 / **leak-auditor 監査パス(RN前提、CRITICAL 0)**
- 残WARN: W-2「iOS アプリスイッチャーのスナップショットは inactive→lock の JS 再レンダリング競合に依存(保証なし)」→ 実機検証で確認。NG なら expo-blur 等でネイティブ遮蔽を検討

### 実機検証チェックリスト(ユーザー実施待ち。`cd apps/mobile && pnpm start` → Expo Go)

1. iOS: reveal 中にホームへスワイプ → アプリスイッチャーのスナップショットに手札が写らないか(W-2)
2. iOS: reveal 中に通知センター/コントロールセンターを引き出したとき locked に落ちるか
3. Android: reveal 中の Recents サムネイル・スクリーンショットが黒画面か(FLAG_SECURE)
4. スワイプキル→再起動: locked で復帰し、起動時に SetupScreen が一瞬出ないか(hydration ゲート)
5. スライダーを素早く最後まで動かしてもクラッシュしないか
6. ひととおりのハンド進行(fold勝ち / showdown / all-in ランアウト演出 / gameOver)

## 前Phase: Expo移管 Phase M1: pnpm ワークスペース化 + core 切り出し(2026-07-17)

方針(ユーザー承認済み): Expo(React Native)へUIを移管し、リッチグラフィックは移管後に RN 側で実装する。Web版 v0.1 は凍結気味に維持。

- `packages/core`(@pass-and-play/core)を新設し、`src/types` → `src/core/*` → 旧 `src/store/gameStore.ts` を移動。core系テスト4ファイルも `packages/core/tests/` へ(importパスのみ書き換え)
- `useGameStore` シングルトンを `createGameStore(getStorage)` ファクトリに変更。storage はプラットフォーム側が注入(Web: localStorage / RN: AsyncStorage 予定)。**partialize / merge / persist name は core 側に閉じ込め、アプリ側で上書きさせない**
- Web側シム: `src/store/gameStore.ts`(localStorage注入+再エクスポート)と `src/types/index.ts`(型再エクスポート)により **UIコンポーネントは無変更**
- next.config に `transpilePackages: ['@pass-and-play/core']`。Vercel はルートの Next アプリのまま(設定変更不要)
- 申し送りだった `betting.test.ts:177` の prefer-const lint を移動ついでに修正(--fix、ロジック無変更)
- 検証: tsc / テスト120件 / eslint / `pnpm build` すべてパス / **leak-auditor 監査パス**(CRITICAL 0・WARN 0。persist name 'pass-and-play-poker' 不変=既存ユーザーの復元維持を確認)

### 次: Phase M2 — Expo アプリ骨組み

- `apps/mobile`(または `packages/` 外)に Expo アプリを新設し、画面を現状の見た目のまま 1:1 移植
- Web API の置き換え: HandoffGuard(blur/visibilitychange/pagehide)→ `AppState`、localStorage → AsyncStorage アダプタ、history 制御 → ナビゲーション制御、バックグラウンド時のスナップショット隠し(ネイティブなら確実に可能。READMEの既知弱点の解消)
- 移植完了時に leak-auditor 監査を RN 前提でやり直すこと
- INFO申し送り: tests/store.test.ts:12-17 のコメントが旧実装の記述のまま(動作影響なし。次に test-guardian が触るとき更新)

## 前作業

**v0.1 リリース後: all-in ショーダウン演出(2026-07-16)**

- store に UI演出専用フィールド `runOutFrom: number | null` を追加(ランアウト発生時に公開済みだったコミュニティカード枚数。カード情報は持たない・persist対象外・merge で明示 null)。`submitAction` で「showdown 直行かつ直前の公開が5枚未満」を検知して設定、startGame/startNextHand のブラインド全員all-in端ケースは 0
- HandCompleteScreen: runOutFrom があるとき、手札を先に公開(all-in showdown = 公開確定)→ ボードをフロップ3枚→ターン→リバーと1.1秒間隔で条件付きレンダリングでめくる。勝者バナー・獲得額・役ラベル・減光・「次のハンドへ」ボタンはめくり終わるまで非表示。めくり中は「ALL IN / ショーダウン」ヘッダー+ポット総額
- page.tsx: gameOver 直行時(all-in で敗者 bust。2人プレイの all-in の大半)も `GameOverFlow` 経由で最終ハンドの HandCompleteScreen(「最終結果へ」ボタン)を先に表示 → GameOverScreen。申し送りの「gameOver時に最終ハンド表示」も同時に解消
- 検証: テスト120件グリーン(test-guardian が runOutFrom リグレッション7件追加)/ tsc / eslint / build パス / **leak-auditor 監査パス**(CRITICAL 0。INFO-1 の merge 明示リセットは対応済み。WARN は既存の HandCompleteScreen 全state subscribe の残存指摘のみ)

## 前作業: UIビジュアル刷新(2026-07-16)

- ダークテーマ固定のポーカールーム風デザイン(globals.css にフェルト/レール/ゴールドのテーマ変数、body のラジアルグラデーション)
- CardView 刷新(sm/md/lg サイズ、四隅+中央スート、`dimmed` 減光)+ 新コンポーネント CardBack(実カード値を受け取らない純装飾)/ CardSlot / ChipAmount
- TableScreen をフェルトテーブル+席(Seat)レイアウトに刷新。Seat の props は `SeatPlayer`(cards を含まない Pick + hasCards)に限定
- HandoffFlow: confirm/pinEntry/reveal を不透明の全画面 Overlay 化(背後のテーブル遮蔽)、idle/locked はテーブル下のバーに変更。SafePlayer・history 制御・store 側 PIN 照合は維持
- showdown 時に役に使われたベスト5枚をハイライト(`selectHandCompleteView` に `bestFiveCards` 追加。表示専用の導出値で persist 対象外)
- アニメーション: カードフリップイン / 手番グロー / 勝者ポップ / 画面フェード(CSS keyframes のみ)
- 検証: テスト113件グリーン / tsc / eslint / `pnpm build` パス / **leak-auditor 監査パス**(CRITICAL 0。WARN 1件「Seat に cards 込み Player が props 渡し」は SeatPlayer 化で同コミット内に修正済み)

## 前リリース: Phase 10 完了 = 初期版(v0.1)リリース 🎉

- Vercel本番: https://pass-and-play-poker.vercel.app (mainへのpushで自動デプロイ)
- **iOS実機検証 全項目パス(2026-07-16、ユーザー確認済み)**: standalone表示 / スリープ復帰・通知シェードでlocked / 戻るスワイプでrevealに戻れない / 復元時locked / セーフエリア干渉なし / オフライン起動
- README.md を製品向けに全面書き換え(遊び方 / iOSアプリスイッチャーのサムネイル注意書き(SPEC 6要件) / 開発手順 / アーキテクチャ)

### 以降の作業候補(未着手)

- タイマー機能のstore/UI連動(SPEC 3.9 / STATE_MACHINE 5)
- PIN設定UI(store側のpinEntry/submitPinは実装済み)
- gameOver時に最終ハンドのshowdown内容を表示(UX改善)
- アイコンPNGのデザイン差し替え(現状プレースホルダ)
- 有料版候補: 3〜6人UI解放 / ブラインド上昇 / 履歴UI / テーマ

## 前Phase: Phase 9 — PWA導入

- @serwist/next 9.5.11 導入。`next.config.ts` で withSerwist(swSrc=src/app/sw.ts、開発時disable)、`src/app/sw.ts`(precache + defaultCache + navigation fallback '/')
- **Next 16 の Turbopack ビルドは serwist(webpackプラグイン)と衝突するため、`build` スクリプトを `next build --webpack` に変更**(dev は Turbopack のまま。SPEC 6 の「serwist第一候補で検証」の帰結)
- `src/app/manifest.ts`(standalone / portrait / theme #059669)、`public/icons/`(プレースホルダPNG、後で差し替え可)、`src/app/apple-icon.png`、layout に appleWebApp・viewport(viewportFit: cover)
- 生成物 `public/sw.js` は .gitignore 済み。SW登録は @serwist/next が自動注入(本番ビルドのみ)
- 検証: `pnpm build` で sw.js 生成 / `pnpm start` で manifest・sw.js 配信と serviceWorker.register の注入を確認 / テスト113件グリーン / leak-auditor 監査パス(CRITICALゼロ。SWキャッシュに手札が乗る経路なし、'/'は静的シェル)

### iOS実機検証チェックリスト(ユーザー実施。Vercelデプロイ後)

1. ホーム画面追加 → standalone 表示・アイコン
2. **standalone でスリープ復帰/アプリ切替/通知シェード → locked に落ちるか**(leak-auditor WARN: iOSはstandaloneでblurが発火しない場合がある。NGなら freeze イベント等を追加)
3. エッジスワイプの戻る操作で reveal に戻れないか
4. セーフエリアとアクションボタンの干渉(viewportFit: cover)
5. 機内モードでオフライン起動(SWのfallback)

## 前Phase: Phase 8 — Role B(UI実装)+ メインセッション(レビュー・leak-auditor CRITICAL 2件修正)

- 画面: `src/components/` — SetupScreen(名前2人+チップ/SB/BB設定+バリデーション)/ TableScreen(ポット・コミュニティ・プレイヤー状態・手番)/ HandoffFlow(idle/locked→confirm1→confirm2一方向スライド→reveal、PINあり時はpinEntry)/ ActionPanel(fold/check/call/bet/raise/allIn、合法性の事前フィルタ)/ HandCompleteScreen / GameOverScreen / CardView / HandoffGuard
- store 追加: `beginHandoff / confirmIdentity / revealCards / submitPin / concealCards / lock / resetToSetup`、`validateGameConfig`(SPEC 2、startGame境界でthrow)、`selectVisibleCards`(reveal中の対象者の手札のみ返す。UIの手札取得はこれ経由のみ)、`selectHandCompleteView`(handComplete表示用の再計算を store に集約)
- 漏洩防止: 手札DOM出力は reveal 中の `selectVisibleCards` 経由のみ(条件付きレンダリング)/ HandoffGuard が visibilitychange・blur・pagehide で lock() / reveal 中は history.pushState + popstate で lock(ブラウザバックで reveal に戻れない)/ handoff画面への props は `SafePlayer = Pick<Player,'id'|'name'>` に限定(cards を props に流さない)
- 独立レビューW-1(configバリデーション)・W-2(復元時の timer.durationSec を persisted config から導出)対応済み
- 検証: `pnpm test` 113件グリーン / `tsc --noEmit` / `pnpm build` / eslint(変更ファイル)すべてパス
- **leak-auditor 監査パス**(初回 CRITICAL 2件 → 修正 → 再監査で解消確認):
  - C-1: HandCompleteScreen の showdown 判定が `status !== 'folded'` で、多人数時に busted 傍観者の混入で fold勝者の手札が公開されうる欠陥 → `selectHandCompleteView` に集約し「非fold・非sittingOut・拠出>0・手札あり」で判定。リグレッションテスト追加
  - C-2: handoff 各画面に cards 込み Player が props で渡っていた(STATE_MACHINE 4 不変条件違反) → SafePlayer に全面変更

## 次の担当への依頼

**Phase 9: PWA**(@serwist/next を第一候補に検証 → だめなら @ducanh2912/next-pwa → 自前SW。SPEC 6)

- manifest(standalone・アイコン)、オフライン動作、iOS実機検証項目は SETUP_PLAN.md セクション5(ホーム画面追加 / スリープ復帰でlocked / ブラウザバックでrevealに戻れない / セーフエリア)
- 完了時に leak-auditor 監査(SWキャッシュに機微が乗らないこと。localStorage は SW スコープ外だが確認)

### 未対応・申し送り

- タイマー機能のUI・store連動が未実装(SPEC 3.9 / STATE_MACHINE 5。デフォルトOFFのため初期リリースはこのままでも可。実装するなら reveal 中のみカウント・timeout で autoCheckOrFold)
- PIN設定UI が未実装(Player.pin は常に null。pinEntry 画面と submitPin は実装済みなので設定画面に PIN 入力を足せば有効化される)
- ~~gameOver 時に最終ハンドの showdown 内容が表示されない~~(2026-07-16 GameOverFlow で解消)
- HandCompleteScreen の `useGameStore()`(全状態subscribe)は将来 selector 化を検討(leak-auditor I-A、効率面のみ)
- `tests/betting.test.ts:177` の pre-existing prefer-const lint(次にファイルを触るときに修正)

### 人間承認待ち

- **CLAUDE.md/STATE_MACHINE の文言と showdown 表示の整合**: handComplete 画面は showdown 成立時に参加者全員の手札を表示する(ポーカーとして必須。SPEC 4.5 の「fold勝ちは手札公開なし」の対偶で showdown は公開が前提)。一方 CLAUDE.md の文言は「手札DOM出力は reveal のみ」。leak-auditor は showdown 公開を妥当と判断済みだが、CLAUDE.md 側に「showdown 後の handComplete 画面を除く」の明文化が必要(確定仕様の文言変更=人間承認)
- SPEC 4.5 の odd chip 文言明確化(「ボタンの左隣から時計回りで最初の eligible 勝者へ」)
- 3人以上のチョップ端数方式(まとめて1人 vs 1枚ずつ)を多人数版解放前に確定
- persist 対象への `activePlayerId`/`dealerButtonPlayerId` 追加を SPEC 5 に反映

## 注意すべきSPEC・制約

- 手札漏洩防止(CLAUDE.md 最優先): reveal 中の `selectVisibleCards` 経由・条件付きレンダリングのみ。CSS隠し禁止。HandoffGuard のイベントリスナーと reveal の history 制御を維持すること(削除・変更したら leak-auditor 必須)
- src/core/ は pure function のみ。ゲームロジックはコンポーネントに書かない(store の selector/action に集約)
- pnpm のみ。テストを通すためのテスト改変禁止
