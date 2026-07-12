# STATE_MACHINE.md — 状態遷移仕様

SPEC.md とセットで参照。実装で迷いやすい3点（BBオプション・全員オールイン自動進行・fold勝ち早期終了）を明示する。

---

## 1. ハンド全体のフェーズ遷移

```
setup
  └─[ゲーム開始]→ postingBlinds

postingBlinds
  ├─ ボタン決定 → SB/BB を強制ポスト
  ├─ totalContribution / currentBet に反映
  ├─ ブラインドポストはアクションに数えない（hasActedThisRound=false のまま）
  ├─ BB プレイヤーに hasOption = true
  └─→ preflop

preflop ─[ベッティングラウンド]→ flop
flop    ─[ベッティングラウンド]→ turn
turn    ─[ベッティングラウンド]→ river
river   ─[ベッティングラウンド]→ showdown
showdown ─[ポット生成→分配]→ handComplete

handComplete
  ├─ chips=0 のプレイヤーを status='busted'
  ├─ 残り1人 → gameOver（勝敗表示）
  └─ 残り2人以上 → リセット（SPEC 4.6）→ ボタン移動 → postingBlinds
```

## 2. 1ストリート分のベッティングラウンド（サブ状態機械）

```
ラウンド開始
  └─ actingOrder 構築
       preflop: BBの左隣から時計回り（ヘッズアップは SB=ボタン から）
       postflop: ボタンの左隣から時計回り（ヘッズアップは BB から）
  ↓
次手番を actingOrder から取得（folded/allIn/busted/sittingOut はスキップ）
  ↓
┌─ アクション待ち（ハンドオフ reveal 完了後にタイマー作動）
│    ├─ fold  → status='folded'
│    ├─ check → （currentBet==currentMaxBet のときのみ合法）
│    ├─ call  → currentBet を currentMaxBet に揃える
│    ├─ bet/raise →
│    │     ├─ 合法判定: 到達額 >= minRaiseTo（all-inは額不問）
│    │     ├─ フルレイズ成立時:
│    │     │    currentMaxBet / lastFullRaiseAmount / minRaiseTo 更新
│    │     │    lastAggressorPlayerId 更新
│    │     │    レイザー以外の active 全員: hasActedThisRound=false, hasOption=true
│    │     └─ short all-in（フルレイズ未満）: 上記の立て直しを行わない（reopenなし）
│    └─ all-in → status='allIn'（額に応じて call / bet / raise 扱い）
│
└─ アクション完了: 本人の hasActedThisRound=true, hasOption=false
  ↓
【ラウンド終了判定】
  active 全員が hasActedThisRound==true かつ hasOption==false
  かつ currentBet==currentMaxBet
  ├─ 未終了 → 次手番へ
  └─ 終了 → currentBet をクリアして次フェーズへ

※ BBオプション:
   preflop 全員コール → BB は currentBet==currentMaxBet だが hasOption==true
   → 未終了 → BB に手番 → BB が check/raise して初めて hasOption=false → 終了
```

## 3. 特別経路

```
【全員オールイン】
任意のラウンド終了時に判定:
  行動可能な active が 1人以下 かつ ハンド継続中（2人以上が非fold）
    ↓ YES
  残りストリートをベッティングなしで自動公開
  （flop/turn/river の未公開分を順次オープン。actingOrder は空 → 即通過）
    ↓
  showdown へ直行

【fold勝ち】
ベッティングラウンド中、非foldが1人になった瞬間:
  → showdown を経ず handComplete
  → その1人が全ポット獲得（手札公開なし）
```

## 4. ハンドオフ状態遷移

```
idle
 ├─[PINなしの交代]→ confirm1 ─Yes→ confirm2 ─一方向スワイプ→ reveal
 ├─[PINありの交代]→ pinEntry ─4桁一致→ reveal
 └─（PIN不一致 → pinAttempts++ → pinEntry に留まる）

reveal
 └─[手番終了 / 伏せるボタン]→ idle（次の targetPlayerId を設定）

任意の状態から:
 visibilitychange(hidden) / blur / pagehide / 復元 → locked

locked
 └─[再開操作]→ confirm1 または pinEntry（targetPlayerId に応じて）
```

不変条件:
- 手札 DOM 出力は reveal のみ
- locked / confirm / pinEntry では cards を props にも渡さない
- ブラウザバックで reveal へ戻る遷移は存在しない（history制御で打ち消す）

## 5. タイマーとの関係

```
handoff.step != 'reveal'  → timer.isPaused = true
handoff.step == 'reveal' → カウント開始
タイムアウト → timeoutAction 実行（check可能ならcheck、不可ならfold）→ ActionLog に 'timeout'
```
