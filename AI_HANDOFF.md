# AI_HANDOFF.md

## 現在のPhaseと完了内容

**Phase 4 完了(未コミット)** — Role A 担当分

- `src/core/handEval.ts`: evaluateHand / compareScores を実装
  - 全9役判定、wheel (A2345) は 5-high、score は [役の強さ, 主ランク..., キッカー...] の数値タプル(辞書順比較)
- `tests/handEval.test.ts`: テスト先行で24ケース作成(全9役 / 役の強さ順序 / wheel・steel wheel / キッカー比較 / ボードのみチョップ / 3ペア・2トリップスの最良5枚選択 / compareScores)
- 検証: `pnpm test` 31件グリーン(deck 7 + handEval 24) / `tsc --noEmit` エラーなし
- セルフ監査: wheel 5-high・チョップ・scoreタプル仕様 OK / pure function(乱数・時刻・DOM参照なし)OK / 変更ファイルは対象2ファイルのみ / 実装後のテスト改変なし

## 次の担当への依頼

**Role A(高度ロジック担当)— Phase 5: betting engine**

- 対象: `src/core/betting.ts`(スタブあり: buildActingOrder / getNextActorPlayerId / applyAction / isRoundComplete / shouldAutoRunOut)+ `tests/betting.test.ts`(テスト先行)
- 必須ケース(SPEC 7): heads-up preflop順(SB=ボタンが先)/ BBオプション / 全員チェック / bet-call / フルレイズ後の hasActedThisRound・hasOption 立て直し / short all-in 非reopen / fold勝ち / 全員all-in自動進行 / 次ストリートのリセット / minRaiseTo更新
- 完了後 Phase 6(sidePot/showdown)へ。**sidePot のテスト入力は betting エンジンの実出力を使う**(人工値を避ける。SPEC 7)

## 注意すべきSPEC・制約

- docs/SPEC.md 3.5 / 4.1–4.3、docs/STATE_MACHINE.md セクション2・3 が正
- hasOption: preflop開始時はBBのみtrue / フルレイズでレイザー以外のactive全員true / short all-inでは立て直さない(SPEC 3.3)
- ラウンド終了条件: active全員 hasActedThisRound && !hasOption && currentBet==currentMaxBet(SPEC 4.2)
- minRaiseTo = currentMaxBet + lastFullRaiseAmount(SPEC 4.3)
- src/core/ は pure function のみ(乱数・時刻は引数注入)。GamePhase 単一真実、playerId ベース管理
- pnpm のみ使用。対象外ファイル変更禁止。テストを通すためのテスト改変禁止
