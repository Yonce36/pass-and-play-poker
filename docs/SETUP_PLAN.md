# Pass & Play Poker — Claude Code 開発環境セットアップ計画（リスタート版）

## 0. このドキュメントの位置づけ

- 設計書（review-request.md）＋外部AIレビューで確定済みの仕様を前提に、
  **Claude Code を主開発エージェントとした環境構築と運用ルール**を定める。
- 体制は「二段階＋監査」: 実装（メインエージェント）→ 監査（サブエージェント）→ 人間が承認。
- brief.md 相当の契約文書は本リポジトリでは `CLAUDE.md` ＋ `docs/SPEC.md` が担う。

---

## 1. 確定済み仕様（設計書MDに未反映の差分。SPEC.mdに必ず転記）

レビューで確定した以下を正とする。設計書MDと矛盾したらこちらが優先。

1. `Player.hasOption: boolean` を追加（BBオプション・再アクション義務を表現）
2. `BettingState.actingOrder: string[]` を追加（次手番の決定的導出）
3. `BettingState.street` は **削除**。`GamePhase` を単一の真実とする
4. odd chip: 「ボタンから時計回りで最初の eligible プレイヤー」に固定
5. short all-in（フルレイズ未満）はアクションを **reopen しない**
6. バースト＝退場。リバイなし。2人版は相手バーストで終局・勝敗表示
7. アンドゥなし。アクション確定後の取り消し不可
8. ブラインドは固定（上昇は有料版候補）。初期チップ/SB/BB は設定画面で変更可
   （デフォルト 1000 / 10 / 20。バリデーション: BB > SB、チップ > BB、正整数）
9. `HandResult.score` は数値タプル（辞書順比較）。bigint不使用
10. persist: `reveal` 状態は保存しない。復元時 `handoff.step` は強制 `locked`
11. iOSアプリスイッチャーのサムネイルは技術で完全防御不可 → 運用割り切りと明記
12. ActionLog は実装するがUI非表示・persist対象外
13. 最小対応幅 375px（iPhone SE級）。iPhone主要ターゲット
14. 実装順序: deck → handEval → **betting** → **sidePot/showdown** → store → UI → PWA
    （設計書MDの Phase 5/6 は入れ替え）

---

## 2. リポジトリ初期化手順

```bash
# 1. プロジェクト作成
pnpm create next-app@latest pass-and-play-poker
#    TypeScript: Yes / Tailwind: Yes / App Router: Yes / src dir: Yes

cd pass-and-play-poker

# 2. 依存
pnpm add zustand
pnpm add -D vitest @vitejs/plugin-react jsdom
pnpm add -D prettier eslint-config-prettier
# PWAライブラリは Phase 9 で比較検討のうえ導入（serwist優先で検証）

# 3. 設定ファイル
#    .prettierrc / vitest.config.ts / .vscode/settings.json (formatOnSave)

# 4. Claude Code 用ファイル配置（本パッケージ同梱）
#    CLAUDE.md → リポジトリルート
#    .claude/agents/*.md → そのまま配置
#    docs/SPEC.md → 設計書v3（確定差分を反映したもの）
#    docs/STATE_MACHINE.md → 状態遷移図（前回作成のテキスト3枚）

# 5. Git / デプロイ
git init && git add -A && git commit -m "chore: project scaffold"
# GitHubリポジトリ作成 → push → Vercel連携（main自動デプロイ）
```

### package.json scripts（最低限）

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "next lint",
    "format": "prettier --write ."
  }
}
```

---

## 3. Claude Code サブエージェント構成（二段階＋監査）

```
メインエージェント（実装担当）
  │  Phase単位で実装。core/ は pure function 厳守
  │
  ├─ rules-auditor      … ポーカールール監査（読み取り専用）
  ├─ leak-auditor       … 手札漏洩・persist監査（読み取り専用）
  └─ test-guardian      … テスト先行・テスト品質監査
```

### 役割分担

| エージェント | 起動タイミング | 見るもの | 書き込み権限 |
|---|---|---|---|
| メイン | 常時 | 全体 | あり |
| rules-auditor | betting / sidePot / showdown / engine 変更後 | core/ と SPEC.md の整合 | なし（指摘のみ） |
| leak-auditor | store / handoff / persist / UI 変更後 | reveal以外でのカード露出、persist対象 | なし（指摘のみ） |
| test-guardian | 各Phase開始時と完了時 | テストケース網羅、テスト改変の検知 | tests/ のみ |

### 運用ルール（友擦り防止）

- **監査エージェントは実装コードを修正しない。** 指摘をメインに返し、メインが修正する。
- **テストを通すためにテストを書き換えることを禁止**（test-guardian が検知対象とする）。
- 監査でCRITICAL指摘が出たPhaseはコミットしない。修正→再監査→グリーンでコミット。
- 人間（Yoshiki）の承認ポイント: 各Phase完了時のコミット前に diff とテスト結果を確認。

---

## 4. Phase別 Claude Code 指示テンプレート

各Phaseの最初の指示は次の形式で統一する:

```
Phase N を実施します。
対象: <core/xxx.ts / tests/xxx.test.ts>
参照: docs/SPEC.md セクションX、docs/STATE_MACHINE.md
完了条件: <pnpm test がグリーン / 型エラーなし>
制約: CLAUDE.md のルールに従う。対象外ファイルは変更しない。
完了後、<rules-auditor / leak-auditor> に監査させてから報告すること。
```

### Phase一覧（確定順序）

| Phase | 内容 | 監査 |
|---|---|---|
| 0 | SPEC.md / STATE_MACHINE.md をリポジトリに配置 | 人間 |
| 1 | scaffold・lint・test・Vercel疎通 | — |
| 2 | types/ と core/ の骨格（ダミーpure function） | rules-auditor |
| 3 | deck / shuffle ＋テスト | test-guardian |
| 4 | handEval ＋テスト（wheel, chop, kicker） | rules + test |
| 5 | **betting engine** ＋テスト（BB option, short all-in, heads-up順） | rules + test |
| 6 | **sidePot / showdown** ＋テスト（bettingの実出力を入力に使う） | rules + test |
| 7 | Zustand store統合・persist分離 | leak-auditor |
| 8 | UI（setup / table / handoff / reveal / showdown） | leak-auditor |
| 9 | PWA（serwist比較→導入、iOS実機検証） | leak-auditor |
| 10 | リリース（README、実機プレイテスト） | 人間 |

---

## 5. 早期に実機検証する項目（Phase 9 を待たない）

Phase 7 完了時点で一度 Vercel デプロイし、iPhone実機で以下だけ先行確認する:

- ホーム画面追加と standalone 表示（manifest最小構成で可）
- `visibilitychange` / スリープ復帰で locked に戻るか
- ブラウザバックで reveal に戻れないか（history制御）
- セーフエリア（ノッチ）とアクションボタンの干渉

ここで問題が出ると UI 設計に跳ね返るため、PWA本対応より前に潰す。
