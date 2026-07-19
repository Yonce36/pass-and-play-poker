# OPERATIONS.md — マルチモデル運用体制(2026-07-19 確定)

本プロジェクトのメイン開発体制。人間(Yoshiki)承認済み。
CLAUDE.md(絶対ルール)・docs/SPEC.md・docs/STATE_MACHINE.md が上位文書。
どのモデルも作業開始時に CLAUDE.md → 本書 → AI_HANDOFF.md の順で読むこと。

## 0. ゲート担当モデル

**Fable 5 が使える間は Fable、使えなくなったら Opus 4.8**(いずれも Claude Code 上。
監査サブエージェント・プロジェクト記憶・git 運用をそのまま引き継ぐ)。
以下「Opus」の記載はゲート担当(Fable/Opus)を指す。

## 1. 役割分担(境界つき)

| モデル | 役割 | やる | やらない |
|--------|------|------|----------|
| **Opus 4.8**(ゲート) | 現場監督+品質ゲート | フェーズ分解、受け入れ条件、Codexへの指示、レビュー、rules/leak/test 監査、commit/push、AI_HANDOFF、**ピール/handoff/core** | 全部自分で実装し続けてセッションを溶かすこと |
| **GPT (Codex)** | 実装ワーカー | タイマーUI、PIN設定UI、純装飾の部品、境界付きバグ修正 | handoff/reveal/persist/core、監査なしの完了宣言 |
| **Grok 4.5** | クリエイティブ+壁打ち | 画像素材、UX/演出アイデア、雰囲気レビュー、実機感の言語化、方針の壁打ち | 危険パスの本実装、独自に main へ載せること |
| **人間(Yoshiki)** | 最終承認 | 実機の感触評価、W-2等の実機検証、仕様の最終承認(人間承認待ち案件) | — |

## 2. ワークフロー

```text
1. 人間 / Grok … 感触・方向のインプット
2. Opus …………… タスク分解 + 受け入れ条件 + 触ってよいファイルリスト
3. Codex ………… 指定範囲だけ実装
4. Opus …………… 差分レビュー + leak/rules/test 監査
5. Opus …………… AI_HANDOFF 更新 + commit/push
6. 人間 ………… 実機確認 → 次フェーズへ
```

**完了の定義(全モデル共通)**: 動いた ≠ 完了。
**監査パス + AI_HANDOFF 更新 + commit までが1単位。**

### 鉄則

- **Codex は commit しない。Opus が監査してから main へ載せる**
- Grok の成果物(素材・提案)も Opus 経由で組み込む(直接 main に載せない)
- 手札漏洩防止(CLAUDE.md)に触れる変更は、どのモデルの実装でも leak 監査必須

## 3. Codex への指示テンプレ(最小形)

- 目的(1行)
- 触ってよいパス / 触るなパス
- やってはいけないこと(手札DOM、CSS隠し、core ロジック)
- 受け入れ条件(tsc / 該当テスト / 画面操作)
- 出してほしいもの(**差分要約のみ。commit はするな**)

## 4. フェーズ別の割り当て(現行ロードマップ)

| フェーズ | 主 | 副 |
|----------|----|----|
| いま(M3-A/B 実機評価) | **人間** | Grok(感触の言語化・改善案) |
| フィードバック微調整 | Opus または Codex(範囲次第) | Grok(方向) |
| M3-C タイマー / PIN設定UI | **Codex** | Opus レビュー・監査 |
| M3-C ピール(handoff/reveal に触れる) | **Opus 専属** | Grok(ジェスチャ感の壁打ちのみ) |
| アイコン・カード裏・チップ素材 | **Grok** | Opus が組み込み |
| core / 仕様変更 | **Opus**(可能なら Fable) | — |

## 5. 素材の受け渡し

- Grok 生成画像は `apps/mobile/assets/` に置く
  (card-back.png 1024×1536 / icon.png 1024×1024 / chip-*.png 512×512 透過)
- 仕様詳細(対称性・余白バンド・縮小耐性)は AI_HANDOFF.md の素材仕様を参照
- 組み込み(Image化・角丸・解像度)はゲート担当が行う

## 6. 不可侵事項(人間承認なしに変更禁止)

- `packages/core` のロジックとテスト期待値(SPEC 確定仕様の写し)
- persist name `'pass-and-play-poker'`(既存セーブが消える)
- 手札漏洩防止の実装(selectVisibleCards 経由のみ / SafePlayer props / AppState lock / FLAG_SECURE / hydration ゲート)

## 7. セッション開始プロンプト(コピペ用)

### ゲート担当(Claude Code: Fable または Opus)

```
このプロジェクトのゲート担当(現場監督+品質ゲート)として作業します。
CLAUDE.md → docs/OPERATIONS.md → AI_HANDOFF.md の順で読み、現在地を把握してから、
AI_HANDOFF.md の「次」に該当するタスクを OPERATIONS.md の分担に従って進めてください。
実装ワーカーに出せるものは Codex に指示テンプレで委譲し、自分はレビュー・監査・コミットに徹すること。
```

### Codex(タスクごとに Opus がテンプレで発行)

セクション3のテンプレを使う。スタンドアロンで使う場合も冒頭に
「CLAUDE.md と docs/OPERATIONS.md の制約に従う。commit しない」を必ず含める。

### Grok

```
Pass & Play Poker(1台のスマホを手渡しして遊ぶオフラインポーカー)のクリエイティブ担当です。
担当: 画像素材の生成・UX/演出のアイデア・雰囲気レビュー。コードの本実装はしない。
成果物はファイルと文章で渡し、組み込みはゲート担当(Claude)が行う。
[ここに個別の依頼を書く]
```
