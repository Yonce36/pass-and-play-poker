# AI_HANDOFF.md

## 現在のPhaseと完了内容

**Phase 7 完了** — Role B 担当分(Zustand store 統合・persist 分離)

- `src/store/gameStore.ts`(新規): `useGameStore`(Zustand + persist)
  - `startGame(playerNames, configOverrides?, random?)`: config マージ → Player生成(id=`player-${seatIndex}`) → デッキ生成+シャッフル(注入乱数) → ホールカード配布(ボタン左隣から時計回りで1枚ずつ2周) → `postBlinds` → `phase='preflop'`
  - `submitAction(action, timestamp?)`: core `applyAction` を呼び、結果が `'showdown'` なら 非fold(active/allIn)全員を `evaluateHand`→`buildPots`→`distributePots` で払い戻し、結果が `'handComplete'`(core側はfold勝ちのときのみこの値を返す)なら唯一の残存者に `buildPots` の全ポットを払い戻し(手札公開なし)。どちらの経路でも直後に busted 判定・残り1人なら `gameOver` 判定(`finalizeHandComplete`)
  - `startNextHand(random?, timestamp?)`: `phase!=='handComplete'` ならエラー。SPEC 4.6 のリセット(currentBet/totalContribution/hasActedThisRound/hasOption/cards/pots/communityCards/deck再生成/betting初期化)、ボタンをbusted/sittingOutでない次の着席者へ移動、handNumber+1、再度配布→`postBlinds`
  - **rules-auditor申し送り#1に対応**: `startHand` 内で `postBlinds` 直後に手番不在(`activePlayerId===null`)をチェックし、ブラインドポストだけで全員all-inになる端ケース(デッドロック)を検知したら即座に残りコミュニティカードを公開して showdown まで自動解決する(`dealRemainingCommunityCards`)。※当初実装の `shouldAutoRunOut` 判定は「片方だけがブラインドall-in」のとき生存プレイヤーの手番を奪う欠陥(レビューC-1、CRITICAL)があり、独立レビュー後に修正・リグレッションテスト追加済み
  - persist: `partialize` で `handNumber/phase/config/players/activePlayerId/dealerButtonPlayerId/betting/pots/communityCards/deck` のみ保存。`handoff`(reveal状態含む)・`actionLog`・`timer.remainingSec` は保存しない。`merge` で復元時に `handoff.step` を無条件で `'locked'` に強制、`timer.isPaused=true` に強制、`actionLog=[]` に強制
- `tests/store.test.ts`(新規、test-guardian作成): 12ケース。deck由来/betting実出力ベース。ブラインドonly all-inのデッドロック回避と、片側ブラインドall-in時に手番を奪わないこと(レビューC-1)のリグレッションケースを含む
- 検証: `pnpm test` 86件グリーン / `tsc --noEmit` エラーなし / `eslint`(このPhaseの変更ファイルは)エラーなし / leak-auditor監査パス(CRITICALゼロ、WARN2件は次フェーズへ申し送り) / 独立レビュー(Fable 5)済み: CRITICAL 1件修正済み、WARN 3件は下記に集約

### 実装上の判断(人間承認が望ましい。SPEC.mdは未変更)

- **persist対象にSPEC 5章の列挙にない `activePlayerId`/`dealerButtonPlayerId` を追加**。理由: この2つがないと復元時に「誰の手番か」「誰がボタンか」を再現できず、ゲーム続行が壊れる。手札やPIN同様オフライン単体アプリの前提で機微情報ではないため実装優先で追加。SPEC.md 5章への追記(人間承認)を推奨(leak-auditor I-1)
- ダイニングオーダーの実装: ボタンの左隣から時計回りで「1枚ずつ2周」。SPECには配布順の明記がないため標準的なポーカーの配り方を採用(ドキュメント記載なし、コード内コメントのみ)

## 次の担当への依頼

**Phase 8候補: UI実装(handoff遷移・タイマー・画面コンポーネント)**

- `src/store/gameStore.ts` の `GameStore` には `startGame`/`submitAction`/`startNextHand` のみ実装。**handoffのconfirm1/confirm2/pinEntry/reveal遷移アクションは意図的に未実装**(このPhaseは「軽量」スコープのため)。UI実装時に store action として追加するか検討すること
- `visibilitychange`/`blur`/`pagehide` のイベントリスナーは未実装(CLAUDE.md必須)。UI層(layout.tsx等)で実装し、`handoff.step`を`'locked'`に強制するstore actionを呼ぶこと
- leak-auditor W-1: store層に「viewer以外の手札を返さない」selector(例: `selectVisibleCards(state, viewerId)`)が存在しない。UIが素朴に `players` を subscribe すると reveal対象外の手札もコンポーネントに渡ってしまうリスクがあるため、UI実装前にselector追加を推奨
- leak-auditor W-2: persistのreveal除外テストが `'reveal'` 文字列のみを禁止する形になっている(現状は`handoff`自体を保存しないため実害なし)。将来`partialize`にhandoff関連フィールドを追加する場合はテスト強化が必要(test-guardianマター)
- 独立レビューW-1: config バリデーション(SPEC 2: BB>SB / startingChips>BB / 正整数、+プレイヤー数2〜6)が未実装。設定画面実装時に `startGame` 境界で実装+テスト(SPEC 7 の必須ケース)
- 独立レビューW-2: persist復元時、`merge` が `timer.durationSec` を初期値から復元するため `config.timerDurationSec` のカスタム値が反映されない。タイマーUI実装時に persisted config から導出するよう修正
- UI実装完了後、再度 leak-auditor 監査必須(手札漏洩・persist)

### 未対応(スコープ外・軽微)

- `tests/betting.test.ts:177` に pre-existing の eslint エラー(`prefer-const`)あり。Phase 5由来でPhase 7の変更対象外のため今回は触っていない。次にそのファイルを触るPhaseで修正を検討

### 人間承認待ち(既存分。引き続き未確定)

- SPEC 4.5 の odd chip 文言を「ボタンの左隣から時計回りで最初の eligible 勝者へ」に明確化
- 3人以上のチョップ端数(現状: まとめて1人へ。TDA は1枚ずつ)を多人数版解放前に確定
- 本Phaseで追加した persist対象(`activePlayerId`/`dealerButtonPlayerId`)をSPEC.md 5章に反映するか

## 注意すべきSPEC・制約

- 手札漏洩防止(CLAUDE.md 最優先): 手札 DOM 出力は handoff.step==='reveal' のみ。CSS隠し禁止。visibilitychange/blur/pagehide で locked(UI実装フェーズで対応)
- src/core/ は変更しない(Phase 7 では変更していない)。Math.random/Date.now は store 側(gameStore.ts)でのみ注入元として直接使用(デフォルト引数)
- pnpm のみ。テストを通すためのテスト改変禁止
