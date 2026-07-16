# AI_HANDOFF.md

## 現在のPhaseと完了内容

**Phase 8 完了** — Role B(UI実装)+ メインセッション(レビュー・leak-auditor CRITICAL 2件修正)

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
- gameOver 時に最終ハンドの showdown 内容が表示されない(HandCompleteScreen を経由せず GameOverScreen に直行するため。UX改善候補)
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
