# CLAUDE.md — Pass & Play Poker

このリポジトリで作業するすべてのエージェントが従う契約文書。
仕様の詳細は docs/SPEC.md、状態遷移は docs/STATE_MACHINE.md を正とする。

## プロダクト

1台のスマホを手渡しして遊ぶ完全オフラインのテキサスホールデムPWA。
初期版は無料・広告なし・2人専用。core は最初から 2〜6人対応で設計する。

## 技術前提

- Next.js App Router / TypeScript strict / Tailwind / Zustand(+persist)
- パッケージマネージャーは **pnpm のみ**。npm/yarn のコマンド・lockfile を生成しない
- サーバー・DB・認証・環境変数なし。全ロジックはクライアント完結

## アーキテクチャ原則

1. `src/core/` は **pure function のみ**。React・Zustand・DOM・Date.now・Math.random を直接参照しない
   （乱数・時刻は引数で注入する。テスト再現性のため）
2. ゲームロジックをコンポーネント内に書かない。store action → core 関数呼び出しの一方向
3. `GamePhase` が進行状態の単一の真実。street の二重管理をしない
4. playerId ベースで管理（index 直参照禁止）

## 確定仕様（変更には人間の承認が必要）

- Player.hasOption で BBオプション/再アクション義務を表現
- BettingState.actingOrder（playerId配列）で次手番を決定的に導出
- short all-in（フルレイズ未満）はアクションを reopen しない
- odd chip はボタンから時計回りで最初の eligible プレイヤーへ
- HandResult.score は数値タプル・辞書順比較
- リバイなし／アンドゥなし／ブラインド固定（初期値は設定画面で変更可、デフォルト 1000/10/20）
- ActionLog は実装するが UI 非表示・persist 対象外

## 手札漏洩防止（最優先・違反は即修正）

- 手札カード情報は `handoff.step === 'reveal'` のときだけ DOM に出力する
  （CSS非表示・opacity:0 での「隠し」は禁止。条件付きレンダリングで DOM 自体に出さない）
- persist 対象から reveal 状態を除外。復元時は handoff.step を強制的に 'locked'
- visibilitychange / blur / pagehide で locked へ遷移するハンドラを必ず維持する
- これらに触れる変更をしたら leak-auditor の監査を受けてからコミットする

## テスト規律

- core のロジックはテスト先行（Phase開始時に test-guardian がケース一覧を作る）
- **テストを通すためにテスト側を弱める変更は禁止**。仕様起因でテストを変える場合は
  SPEC.md の該当箇所を引用して理由をコミットメッセージに書く
- 実行: `pnpm test`（CI相当）、`pnpm test:watch`（開発中）

## ワークフロー

- Phase 単位で作業。指示されたPhaseの対象ファイル以外を変更しない
- 各Phase完了 = テストグリーン＋監査パス＋人間承認 → コミット
- コミットメッセージ: `feat(core): ...` / `test: ...` / `chore: ...` 形式
- 難所（betting / sidePot）は feature ブランチで作業し、main へは監査後にマージ

## マルチモデル運用

メイン開発は docs/OPERATIONS.md の分担(ゲート担当=Claude / Codex=境界付き実装 / Grok=クリエイティブ)に従う。
完了の定義は「監査パス + AI_HANDOFF.md 更新 + commit」。Codex・Grok の成果物はゲート担当の監査を経てから main へ載せる。

## サブエージェント

- rules-auditor: ポーカールールと SPEC.md の整合監査（読み取り専用）
- leak-auditor: 手札漏洩・persist 監査(読み取り専用)
- test-guardian: テストケース設計とテスト改変の検知（tests/ のみ書き込み可）

監査エージェントは実装コードを修正しない。指摘を返し、メインが修正する。
