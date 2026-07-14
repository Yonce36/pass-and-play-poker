# AI_HANDOFF.md

## 現在のPhaseと完了内容

**Phase 6 完了** — Role A 担当分(core ロジック完成: deck / handEval / betting / sidePot / showdown)

- `src/core/sidePot.ts`: buildPots(SPEC 4.4 レベル方式。folded 拠出はポットに入り eligible から除外。eligible 同一の連続層は統合)
- `src/core/showdown.ts`: distributePots(ポットごとに eligible のみで比較、チョップ、端数はボタンの左隣から時計回りで最初の eligible 勝者へ)
- `tests/sidePot.test.ts`: 10ケース。**入力はすべて betting エンジンの実出力**(SPEC 7)
- 検証: `pnpm test` 74件グリーン / `tsc --noEmit` エラーなし / rules-auditor 監査パス(CRITICALゼロ、WARN 2件中 W2 は修正済み)

## 次の担当への依頼

**Role B(軽量・UI担当)— Phase 7: Zustand store 統合・persist 分離**

- 対象: `src/store/`(新規)。core 関数(postBlinds / applyAction / buildPots / distributePots / evaluateHand / createDeck / shuffleDeck)を store action から呼ぶ一方向構成
- 必須実装:
  - ハンド開始(deck 生成+シャッフル(乱数注入)→ ホールカード配布 → postBlinds)
  - showdown 到達時: evaluateHand → buildPots → distributePots → chips へ payout 反映 → handComplete
  - fold勝ち: showdown を経ず全ポットを勝者へ(手札公開なし)
  - SPEC 4.6 のハンドリセット(currentBet / totalContribution / hasActed / hasOption / cards / pots / communityCards / deck 再生成 / ボタン移動)、busted 判定、残り1人で gameOver
  - persist: partialize で handoff の reveal 状態・actionLog・timer.remainingSec を除外。復元時 handoff.step 強制 'locked'
- 完了後 leak-auditor の監査必須(手札漏洩・persist)

### rules-auditor からの申し送り(Phase 7 で対応)

1. postBlinds 直後に shouldAutoRunOut / activePlayerId===null チェック(blind で全員 allIn の端ケースのデッドロック防御)
2. distributePots は eligible 全員の HandResult を要求 → showdown では非fold全員を evaluateHand すること
3. 1人だけ eligible のサイドポット(コールされなかった超過分)は UI 上「返還」として見せる

### 人間承認待ち(SPEC 文言。実装は標準ルール準拠で済み)

- SPEC 4.5 の odd chip 文言を「ボタンの左隣から時計回りで最初の eligible 勝者へ」に明確化
- 3人以上のチョップ端数(現状: まとめて1人へ。TDA は1枚ずつ)を多人数版解放前に確定

## 注意すべきSPEC・制約

- 手札漏洩防止(CLAUDE.md 最優先): 手札 DOM 出力は handoff.step==='reveal' のみ。CSS隠し禁止。visibilitychange/blur/pagehide で locked
- src/core/ は変更しない(Phase 7 は store のみ)。Math.random は store 側で注入する(core に入れない)
- pnpm のみ。テストを通すためのテスト改変禁止
