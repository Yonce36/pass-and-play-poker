# AI_HANDOFF.md

## 現在のPhaseと完了内容

**Phase 5 完了** — Role A 担当分

- `src/core/betting.ts`: buildActingOrder / getNextActorPlayerId / isRoundComplete / shouldAutoRunOut / postBlinds(追加関数) / applyAction(fold勝ち・ストリート遷移・全員オールイン自動進行を含む)を実装
- `tests/betting.test.ts`: テスト先行33ケース(HU/3人の行動順 / postBlinds / BBオプション / 全員チェック / bet-call / フルレイズ義務リセット / short all-in非reopen・レイズ権拒否 / fold勝ち / 全員all-in自動進行 / 次ストリートリセット / minRaiseTo更新 / 不正アクション / 純粋性)
- 検証: `pnpm test` 64件グリーン(deck 7 + handEval 24 + betting 33) / `tsc --noEmit` エラーなし
- rules-auditor 監査パス(CRITICALゼロ)。WARN 1件(NaN/非整数ガード)は修正済み

## 次の担当への依頼

**Role A(高度ロジック担当)— Phase 6: sidePot / showdown**

- 対象: `src/core/sidePot.ts`(buildPots)/ `src/core/showdown.ts`(distributePots)+ テスト
- **テスト入力は betting エンジンの実出力を使う**(postBlinds → applyAction の列で状態を作る。人工値を避ける。SPEC 7)
- 必須ケース: 2人all-in / 3人all-in / folded拠出 / 複数サイドポット / メインとサイドで勝者相違 / チョップ / odd chip(ボタンから時計回り)
- 監査からの引き継ぎ(要対応): engine 統合時に postBlinds 直後の shouldAutoRunOut / 手番不在(activePlayerId===null)チェックを入れること(blind で全員 allIn になる端ケースのデッドロック防御)

## 注意すべきSPEC・制約

- SPEC 4.4(サイドポット生成: contribution level 方式。folded のチップはポットに入るが eligible に入らない)/ 4.5(分配: ポットごとに eligible のみで比較、チョップ端数はボタンから時計回りで最初の eligible)
- 累積 short all-in は reopen しない(SPEC 4.2 確定仕様。TDA の一部解釈と異なるが変更禁止)
- src/core/ は pure function のみ。playerId ベース管理。pnpm のみ
- 対象外ファイル変更禁止。テストを通すためのテスト改変禁止
