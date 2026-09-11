# FX関連の初期化 引き継ぎ（ローカルPC作業用）

作成日: 2026-09-11
目的: Claude Code で進めていた FX（MT4 日次チェック等）関連の作業を全て初期化する。
クラウド側は完了済み。**残りはローカルPC上にしか無いので、この手順をローカルで実行する。**

---

## 0. 一言サマリー

| 場所 | 状態 | 残作業 |
|---|---|---|
| クラウド（claude.ai/code のセッション） | **完了**。FX関連セッションは全てアーカイブ済み | なし |
| GitHub（Caloriapp / claude-code-rules） | **元々FX関連の変更なし** | なし |
| ローカルPC：スケジュールタスク「Fx mt4 daily check」 | **残っている** | 削除 |
| ローカルPC：Claude Code の memory フォルダ内 FX ファイル | **残っている** | 削除 |
| ローカルPC：MT4連携用スクリプト・ログ（あれば） | 不明 | 確認して削除 |

---

## 1. クラウド側で完了したこと（参考）

- アーカイブ済みセッション（元に戻す場合は claude.ai/code の一覧から「Unarchive」）
  - 「Fx mt4 daily check」 8/24, 8/26, 8/27(2件), 8/28 の計 5件 → アーカイブ
  - 「ガチ速FXについて」 8/25 → アーカイブ
  - 「Fx mt4 daily check」 8/29, 8/30, 8/31, 9/3 の 4件 → 既に一覧から消えていた（削除済み扱い）
- クラウドの Routine（定期実行）一覧に FX 関連は **存在しない**。
  → 毎日 07:06 (JST) に起動していた「Fx mt4 daily check」は **ローカルPCのスケジュール** が発生源。
- リポジトリ確認結果
  - `Guri241/Caloriapp`: FX関連のコード・ブランチなし。
  - `Guri241/claude-code-rules`: FXファイルなし。README に「FX口座などはローカルのみ保持」と明記。

---

## 2. ローカルPCでやること

### 2-1. スケジュールタスク「Fx mt4 daily check」を削除する

発生源はローカルの Claude（デスクトップアプリ / Claude Code CLI）のスケジュール機能。
「Washer lint filter weekly」「Aircon filter biweekly」「Utaite weekly review」と同じ場所に並んでいる。

1. Claude デスクトップアプリを開く
2. スケジュールされたタスク（Scheduled tasks）の一覧を開く
3. 「Fx mt4 daily check」を **削除**（一時停止ではなく削除）
4. 他の FX 系タスク（名前に fx / mt4 / 為替 を含むもの）があれば同様に削除

※ アプリ側に見当たらない場合は Claude Code CLI 側の可能性があるので、ローカルで
   `claude` を起動して `/schedule` や `/cron` 系コマンドで一覧を確認する。

### 2-2. memory フォルダ内の FX ファイルを削除する

Claude Code のメモリは次の場所にある（プロジェクトごとにフォルダが分かれる）。

```
~/.claude/projects/<プロジェクト名>/memory/
```

**該当ファイルを探す（Mac / Linux / Git Bash）**

```bash
grep -rliE "fx|mt4|forex|為替|ガチ速" ~/.claude/projects/*/memory/
```

**該当ファイルを探す（Windows PowerShell）**

```powershell
Get-ChildItem "$env:USERPROFILE\.claude\projects\*\memory\" -Recurse -File |
  Select-String -Pattern "fx|mt4|forex|為替|ガチ速" -List |
  Select-Object -ExpandProperty Path -Unique
```

**削除の手順**

1. 上の検索で出たファイルを開き、内容が FX 関連であることを確認する
   （`fx` は他の単語にも含まれるので、必ず中身を見る。例: `prefix`, `effects`）
2. FX 専用のファイルは削除する
3. 他の話題と混在しているファイルは、FX の段落だけ消す
4. 同じフォルダの `MEMORY.md`（索引ファイル）を開き、FX 関連の行を消す

### 2-3. MT4 連携用のスクリプト・ログを確認する

「Fx mt4 daily check」が MT4 のファイルを読んでいた場合、ローカルに次のようなものが残っている可能性がある。

- MT4 の `MQL4/Files/` 配下に出力していた CSV / ログ
- 日次チェック用に作った Python / PowerShell スクリプト
- チェック結果を溜めていた xlsx / md

見つけ方: 2-1 でタスクを削除する前に、タスクの設定画面（プロンプト本文）を開いて
参照しているパスを控えておく。そのパスにあるファイルを削除する。

---

## 3. ローカルの Claude Code に丸投げする場合

ローカルで `claude` を起動して、以下をそのまま貼り付ける。

```
FX関連の作業を全部初期化したい。クラウド側のセッション整理は済んでいる。
ローカルに残っている次の3つを片付けて。

1. スケジュールタスク「Fx mt4 daily check」（毎日07:06起動）を削除する。
   他にも名前に fx / mt4 / 為替 を含むタスクがあれば削除する。
   削除前にタスクのプロンプト本文を表示して、参照しているファイルパスを控えて。
2. ~/.claude/projects/*/memory/ 配下で fx / mt4 / forex / 為替 / ガチ速 を含むファイルを列挙して。
   FX専用のものは削除、混在しているものはFXの段落だけ削除。MEMORY.md の索引行も消す。
   削除する前に対象一覧を見せて、私の確認を取ってから消して。
3. 1で控えたパスにあるMT4連携用のスクリプト・ログ・CSVを列挙して、確認後に削除して。

最後に、削除したものの一覧と、残したものがあればその理由を報告して。
```

---

## 4. 完了チェックリスト

- [ ] Claude デスクトップアプリのスケジュール一覧に「Fx mt4 daily check」が無い
- [ ] 翌日 07:06 (JST) 以降、claude.ai/code の一覧に「Fx mt4 daily check」が新規作成されていない
- [ ] `grep -rliE "fx|mt4|forex|為替|ガチ速" ~/.claude/projects/*/memory/` が何も返さない
      （無関係な語での誤ヒットは除く）
- [ ] 各 `MEMORY.md` に FX 関連の行が無い
- [ ] MT4 連携用のスクリプト・ログが残っていない
- [ ] 上記が終わったらこのファイル（`FX_CLEANUP_HANDOFF.md`）は削除してよい

---

## 5. 補足

- クラウド側のアーカイブは可逆。必要になったら claude.ai/code の一覧から復元できる。
- `claude-code-rules` リポジトリは共有ルール専用で、`.gitignore` により FX 等の個人データは
  そもそもコミットされない設計になっている。ローカルのファイルを消せば他デバイスへは広がらない。
- 別PCでも Claude Code を使っている場合、そのPCの memory フォルダにも同じ手順（2-2）を適用する。
