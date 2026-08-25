# 生産実績シート DB取り込みマクロ (modDbImport.bas)

DB から当月分の実績を取得して、生産実績シート（A列にブロック見出しと項目名、B〜AF列が1〜31日）の
データ欄へ流し込む Excel VBA です。ADO の遅延バインディングを使うため、**参照設定は不要**です。

## 1. 導入

1. Excel を開き `Alt` + `F11` で VBE を起動
2. メニュー **ファイル → ファイルのインポート** で **`modDbImport_sjis.bas`** を選択
   （日本語版 Windows の VBE は .bas を Shift-JIS として読み込むため、インポートにはこちらを使ってください）
3. ブックを **マクロ有効ブック (.xlsm)** として保存

### コピー＆ペーストで入れる場合

VBE の **挿入 → 標準モジュール** に貼り付けるときは **`modDbImport_paste.txt`** を使ってください。

`.bas` ファイルの1行目にある

```vba
Attribute VB_Name = "modDbImport"
```

は**インポート時にだけ有効な行**で、コードウィンドウに直接貼り付けるとコンパイルエラーになります。
`modDbImport_paste.txt` はこの行を除いた同じ内容です（`.bas` をコピーした場合は、貼り付け後に1行目を削除しても直ります）。
モジュール名は VBE のプロパティウィンドウ（`F4`）の `(オブジェクト名)` で `modDbImport` に変更できます。

**モジュールは2種類あります。使うのはどちらか一方です。**

| ファイル | 用途 |
| --- | --- |
| `modApiImport_paste.txt` | **API(JSON) から取り込む版**（現行）。コピー＆ペースト用 |
| `modApiImport_sjis.bas` | 同上・**インポート** 用（Shift-JIS） |
| `modDbImport_paste.txt` | **Dr.Sum(ODBC) から取り込む版**。コピー＆ペースト用 |
| `modDbImport_sjis.bas` | 同上・**インポート** 用（Shift-JIS） |
| `*.bas`（UTF-8） | GitHub 閲覧用（中身は同一） |
| `README.md` | この説明書 |

API 版は接続文字列・SQL・ODBC の設定を一切持ちません。設定は
① API接続 → ② レコードのキー名 → ③ シートのレイアウト → ④ 項目対応 → ⑤ 値の読み替え → ⑥ 品種の表示名
の6か所で、④以降の考え方は DB 版と同じです。実行は `TestApi` → `ImportFromApi`。

## 2. 設定（モジュール冒頭の ①〜⑤ だけ書き換えます）

順番は ① 接続 → ② キー列名 → ③ レイアウト → ④ 項目対応 → ⑤ 値の読み替え です。
①〜③ は定数、④⑤ は `AddMap` を並べる `Sub` になっています。

### ① 接続・SQL

| 定数 | 内容 |
| --- | --- |
| `CONN_STR` | 接続文字列。既定は **Dr.Sum への ODBC 接続**（下記参照） |
| `TABLE_NAME` | 取得元のテーブルまたはビュー名。Dr.Sum は `dbo.` などのスキーマ修飾を付けません |
| `QUOTE_OPEN` / `QUOTE_CLOSE` | 識別子の引用符。**Dr.Sum は空文字のままが無難**（他DBの場合 SQL Server・Access は `[` `]`、Oracle/PostgreSQL は `"`、MySQL は `` ` ``） |
| `SQL_OVERRIDE` | SQL を自分で書く場合に指定（空なら自動生成）。日付条件は `>= ?` と `< ?` の2つの `?` をこの順で入れる |
| `USE_PARAMETERS` | `False`（既定）= SQL に日付リテラルを埋め込む／`True` = 日付をパラメータで渡す。**Dr.Sum の ODBC では `False` が確実** |
| `DATE_FORMAT` / `DATE_LITERAL_TEMPLATE` | 日付リテラルの作り方（下記「日付の書式」参照） |
| `DATE_PARAM_TYPE` | `USE_PARAMETERS = True` のときの日付パラメータ型。型エラーが出る場合は `adDBTimeStamp` に変更 |

#### Dr.Sum への接続

**方法1: DSN を作って指定（推奨）**

1. Windows の **ODBC データ ソース アドミニストレーター** を開く
   * Excel が 32bit なら **32ビット版**、64bit なら **64ビット版** を使うこと
     （Excelのビット数は「ファイル → アカウント → Excel のバージョン情報」で確認）
2. 「システム DSN」または「ユーザー DSN」→ 追加 → Dr.Sum のドライバーを選択
3. サーバー名・ポート・データベース名を設定して DSN 名を付ける
4. マクロ側に DSN 名を書く

```vba
Private Const CONN_STR As String = "Provider=MSDASQL;DSN=DRSUM;UID=ユーザーID;PWD=パスワード;"
```

**方法2: DSN を作らずドライバーを直接指定**

```vba
Private Const CONN_STR As String = _
    "Provider=MSDASQL;Driver={Dr.Sum ODBC Driver};Server=サーバー名;Port=6001;" & _
    "Database=DB名;UID=ユーザーID;PWD=パスワード;"
```

`Driver={...}` の名称とポート番号は導入バージョンで変わります。ODBC アドミニストレーターの
**「ドライバー」タブに表示されている名称をそのまま**入れてください
（例: `{Dr.Sum ODBC Driver}` / `{Dr.Sum EA ODBC Driver}` / `{Dr.Sum Ver.5.5 ODBC Driver}`）。

#### 日付の書式（`DATE_FORMAT` / `DATE_LITERAL_TEMPLATE`）

`WHERE 日付 >= ? AND 日付 < ?` の `?` に埋め込むリテラルを、Dr.Sum 側の日付列の持ち方に合わせて選びます。
`<DATE>` の部分に `DATE_FORMAT` で整形した文字列が入ります。

| Dr.Sum の日付列 | `DATE_LITERAL_TEMPLATE` | `DATE_FORMAT` | 生成される条件 |
| --- | --- | --- | --- |
| 日付型（スラッシュ・既定） | `"'<DATE>'"` | `"yyyy/mm/dd"` | `>= '2026/07/01'` |
| 日付型（ハイフン） | `"'<DATE>'"` | `"yyyy-mm-dd"` | `>= '2026-07-01'` |
| 文字列 `YYYYMMDD` | `"'<DATE>'"` | `"yyyymmdd"` | `>= '20260701'` |
| 数値 `YYYYMMDD` | `"<DATE>"` | `"yyyymmdd"` | `>= 20260701` |
| ODBCエスケープ | `"{d '<DATE>'}"` | `"yyyy-mm-dd"` | `>= {d '2026-07-01'}` |

取得後の「日」の取り出しは、日付型・`2026-07-01`・`2026/07/01`・`20260701`（文字列/数値）のいずれにも対応しています。

自動生成される SQL は次の形です（`ShowGeneratedSql` で確認できます）。

```sql
SELECT [日付], [設備番号], [直区分], [稼働時間], [良品数], ...
FROM dbo.生産実績
WHERE [日付] >= ? AND [日付] < ?
```

### ② キー列名

| 定数 | 内容 |
| --- | --- |
| `FLD_DATE` | 日付列（1日単位） |
| `FLD_LINE` | 設備番号列（8020 / 8021 / 8022 …） |
| `FLD_SHIFT` | 直区分列（昼 / 夜 / スライダ / テレスコ昼 …）。設備番号だけで一意なら `""` にする |
| `FLD_START` / `FLD_END` | 開始・終了時刻のカラム名（稼働時間を計算する場合） |
| `FLD_BREAK` / `BREAK_MINUTES` | 差し引く休憩。カラムから取るか、一律の分数か |
| `DURATION_UNIT` / `DURATION_DECIMALS` | 計算結果の単位（`"MINUTE"` / `"HOUR"`）と小数桁 |

#### 稼働時間を開始・終了から計算する

DB に稼働時間の列が無く、開始・終了の時刻から求める場合の設定です。
④ の `BuildFieldMap` で `CALC_DURATION` を指定した項目が `終了 − 開始 − 休憩` で計算されます（既定で有効）。

```vba
' ② 開始・終了のカラム名
Private Const FLD_START As String = "開始時刻"
Private Const FLD_END   As String = "終了時刻"

' 休憩の差し引き（FLD_BREAK が優先。使わないなら "" と 0 のまま）
Private Const FLD_BREAK     As String = ""      ' 休憩(分)のカラム名
Private Const BREAK_MINUTES As Long = 0         ' 一律で引く分数

' 単位  "MINUTE"(分) / "HOUR"(時間)
Private Const DURATION_UNIT     As String = "MINUTE"
Private Const DURATION_DECIMALS As Long = 0

' ④ 項目対応
AddMap m, "稼働時間", CALC_DURATION
```

* **日をまたぐ夜勤**（例 20:00 → 5:00）は自動で +24 時間し、540 分と計算します
* 時刻の値は **時刻型 / `08:00` / `0800` / `800` / `08:00:00` / `20260701080000`** のいずれでも読み取れます
* 開始か終了が空（NULL）の場合、そのセルには何も書き込みません
* DB に稼働時間の列がある場合は `AddMap m, "稼働時間", "列名"` に戻せば、計算せずそのまま取り込みます
* 計算結果は `TestQuery` の先頭3件に `稼働時間(計算) = 450` の形で表示されるので、実行前に確認できます

### ④ 項目名 → DB列名（`BuildFieldMap`）

シート A 列の項目名と DB の列を結びつけます。1日 × 設備 × 直に対して DB の行が複数ある
（品番ごとに行が分かれる）ため、項目ごとに**集計方法**と**絞り込み**を指定できます。

```vba
AddCol m, シートの項目名, DBの列名, 集計方法, 絞り込み列, 絞り込み値
```

| 引数 | 内容 |
| --- | --- |
| 集計方法 | `"SUM"` 合計 / `"MAX"` 最大 / `"MIN"` 最小 / `"COUNT"` 件数 / `"LAST"` 最後の行 / `"FIRST"` 最初の行 |
| 絞り込み列・値 | 使わないなら `""`, `""`。値はカンマ区切りで複数可。末尾 `*` で前方一致、前後 `*` で部分一致 |

```vba
Private Sub BuildFieldMap(ByVal m As Object)
    ' 同じ直の行に同じ値が入るので合計せず MAX
    AddCol m, "稼働時間", "WORKING_HOURS", "MAX", "", ""

    ' その日・その直の全行を合計
    AddCol m, "良品数(個)", "KAKO_CNT", "SUM", "", ""
End Sub
```

`AddMap m, 項目名, 列名` は「集計 `LAST`・絞り込み無し」の短い書き方です。

* 左辺（シートの項目名）は **全角/半角・空白の違いを自動で吸収**します（`ﾃﾚｽｺ` と `テレスコ` も同一扱い）。
* ここに無い項目名は取り込まれず、実行後のメッセージに一覧表示されます。
* 該当する列が DB に無い項目は、行ごとコメントアウトしてください（そのセルは触りません）。
* 「変動値」「直接時間」はシート側の計算式想定のため既定では対象外です。

### 品種ごとの生産数（行の自動追加）

良品数は `KAKO_CNT` の合計、品種別の生産数は `PRODUCT_CNT` の合計です。
1日・1直の中に品種（背番号／品番）ごとの行があるため、**品種ごとに合計**して
`〇〇生産数` という行に入れます。**シートに無い品種が出てきた場合は行を自動で追加**します。

```vba
Private Const SPLIT_ENABLED         As Boolean = True
Private Const SPLIT_COLUMN          As String = "SEBAN"      ' 品種を表す列
Private Const SPLIT_VALUE_COLUMN    As String = "PRODUCT_CNT" ' 品種別の生産数の列
Private Const PRODUCT_ROW_SUFFIX    As String = "生産数"     ' 行名の末尾
Private Const PRODUCT_ROW_ANCHOR    As String = "良品数(個)" ' 追加位置の基準
Private Const AUTO_ADD_PRODUCT_ROWS As Boolean = True
```

動きは次のとおりです。

1. A列が `生産数` で終わる行（`TT生産数`、`825B/TNGA生産数` など）を**品種行**として認識します
2. DB の品種コードを ⑥ の表示名に変換し、`表示名 + 生産数` の行に合計を書き込みます
3. その月に出てきた品種の行がシートに無ければ、**`良品数(個)` の下に行を挿入**して作ります
   （既に品種行がある場合はその直後。書式は上の行から引き継ぎます）
4. 追加した行数は完了メッセージに表示されます

行を増やしたくない場合は `AUTO_ADD_PRODUCT_ROWS = False`、品種別の集計自体が不要なら
`SPLIT_ENABLED = False` にしてください。

### ⑥ 品種の表示名（`BuildProductMap`）

DB の品種コードと、シートの行名に使う表示名の対応です。

```vba
Private Sub BuildProductMap(ByVal m As Object)
    AddMap m, "TMC300D", "TT"          ' → 「TT生産数」の行に入る
    AddMap m, "TMC825B", "825B/TNGA"   ' → 「825B/TNGA生産数」の行に入る
End Sub
```

登録が無い品種は**コードがそのまま行名**になり（`TMC900X` → `TMC900X生産数`）、
その行が無ければ自動で追加されます。複数のコードを同じ表示名に登録すれば、まとめて合計されます。

### ⑤ 値の読み替え（`BuildShiftMap` / `BuildLineMap`）

シートの見出し表記と DB に入っている**値**が違う場合に登録します（カラム名ではなく値です）。
直区分が `1` = 昼 / `2` = 夜 の数字で入ってくるため、既定で次の変換が入っています。

```vba
' BuildShiftMap : シート「昼」 → DB の値 "1"
AddMap m, "昼", "1"
AddMap m, "夜", "2"
```

`8022 ﾃﾚｽｺ 昼` のように区分名が付く見出しは、**完全一致で見つからない場合に「昼」「夜」を含むか**で判定します
（`SHIFT_PARTIAL_MATCH = True`。一致したキーのうち最も長いものを採用するため、`テレスコ昼` を個別登録すればそちらが優先されます）。

`8022 ｽﾗｲﾀﾞ` のように昼夜の区別が無いブロックは、DB に入っている値を個別に登録してください。

```vba
AddMap m, "スライダ", "1"    ' ← DB 側の実際の値に合わせる
```

設備番号も同様です。DB の `LINE_CD` が `AS8046` のように接頭辞付きの場合、規則的なら
`LINE_CODE_PREFIX` を設定するだけで全ブロックに適用されます。

```vba
Private Const LINE_CODE_PREFIX As String = "AS"    ' シート 8020 → DB "AS8020"
```

規則的でない場合は `BuildLineMap` に個別に登録してください（登録があればそちらが優先）。

```vba
AddMap m, "8020", "AS8046"
```

### ③ シートのレイアウト

| 定数 | 既定 | 内容 |
| --- | --- | --- |
| `SHEET_NAME` | `"Sub吸い上げ"` | 取り込み先シートを固定。空にするとアクティブシートが対象。マクロのあるブック → アクティブブックの順に、大文字小文字・全角半角・空白の違いを無視して探します |
| `YEAR_CELL` / `MONTH_CELL` | `A1` / `B1` | 年・月のセル。`2026年` `7月` のような文字列でも、数値・日付でも読み取ります |
| `FIRST_DATA_COL` / `LAST_DATA_COL` | `2` / `32` | B列=1日 〜 AF列=31日 |
| `SCAN_START_ROW` | `2` | 見出し探索の開始行（1行目は年月なので除外） |
| `LINE_LIST` | `"8020,8021,8022"` | ブロック見出しとみなす設備番号。空にすると「`LINE_DIGITS_MIN` 桁以上の数字で始まる行」で判定 |
| `LINE_DIGITS_MIN` | `3` | `LINE_LIST` が空のときの桁数条件 |
| `DAY_COL_MODE` | `"POSITION"` | 日付列の決め方（後述） |
| `DAY_HEADER_ROW` | `0` | `"DATEROW"` のときに読む行番号 |
| `LIMIT_TO_MONTH_END` | `True` | 月末を超える日の列（30日までの月の31日列など）には書き込まない |
| `CLEAR_BEYOND_MONTH_END` | `False` | 月末を超える日の列をクリアする |
| `WRITE_DAY_HEADERS` | `False` | 見出し行の日付欄に 1〜月末 を書き込む |
| `SKIP_FORMULA_CELLS` | `True` | 数式セルは上書きしない |
| `WRITE_ZERO_WHEN_MISSING` | `False` | DB に該当日が無いとき 0 を書くか |
| `CLEAR_BEFORE_IMPORT` | `False` | 取込前に対象欄をクリアするか |
| `AGGREGATE_MODE` | `"LAST"` | 同一 日付×設備×直 が複数レコードある場合 `"LAST"`(後勝ち) / `"SUM"`(合計) |

#### 日付列の決め方（`DAY_COL_MODE`）

| 値 | 動作 |
| --- | --- |
| `"POSITION"`（既定） | **列の位置だけ**で決める。`FIRST_DATA_COL`(B列) = 1日、以降 1列 = 1日。表が空でも使えます |
| `"HEADER"` | 各ブロックの見出し行に入っている `1`〜`31` の数字を読む（数字が無いブロックは `POSITION` で補完） |
| `"DATEROW"` | `DAY_HEADER_ROW` で指定した1行だけを読み、全ブロック共通で使う（日付が入っていれば日付でも可） |

## 3. 実行

| プロシージャ | 内容 |
| --- | --- |
| `ImportFromDb` | **メイン。** 年月セルの月を対象に DB から取得してシートへ書き込む |
| `TestConnection` | 接続文字列の疎通確認 |
| `ShowColumns` | `TABLE_NAME` の**列名と先頭1件の値**を表示。接続できたら最初にこれを実行し、②③④に写します |
| `TestQuery` | **試し取得。** シートには書き込まず、件数・先頭3件の中身・実際の SQL を表示（Dr.Sum の設定確認用） |
| `ShowGeneratedSql` | 実際に投げる SQL を表示 |
| `ClearImportArea` | 取り込み対象欄のみクリア（数式セルは残す） |

実行後、対象ブロック数・取得レコード数・書き込みセル数・未対応の項目名がメッセージで表示されます。

## 3.5 ODBC がつながった後の設定手順

`TestConnection` が成功したら、次の順で埋めていきます。

**手順1** `TABLE_NAME` を実際のテーブル（またはビュー）名にする → `ShowColumns` を実行

列名の一覧と先頭1件の値が表示されます。ここに出た**列名をそのままコピー**して以降に貼り付けます。
エラーになる場合は `TABLE_NAME` が違います。

**手順2** ② のキー列名を埋める

```vba
Private Const FLD_DATE  As String = "実績日"      ' ShowColumns に出た日付列
Private Const FLD_LINE  As String = "設備CD"      ' 8020 などが入っている列
Private Const FLD_SHIFT As String = "直区分"      ' 昼夜の列（無ければ "" ）
```

**手順3** ③ の項目名対応を埋める（左=シートA列の項目名、右=`ShowColumns` に出た列名）

```vba
AddMap m, "稼働時間",           CALC_DURATION     ' ← 開始・終了から計算（列がある場合は列名）
AddMap m, "良品数(個)",         "良品数"
AddMap m, "TT生産数",           "TT生産数"
AddMap m, "825B/TNGA生産数",    "TNGA生産数"
AddMap m, "基準人数(最小人数)", "基準人数"
```

**手順4** `TestQuery` を実行して確認する

* **件数が0件** → 日付の条件が合っていません。`ShowColumns` に出た日付の値の形（`2026-07-01` なのか `20260701` なのか）を見て、上の「日付の書式」の表から `DATE_LITERAL_TEMPLATE` / `DATE_FORMAT` を選び直します
* **件数は出るが「日 = 0」** → 日付の値の形が想定外です。値をそのまま連絡してください
* **列が見つからないエラー** → ②③の列名の綴りを `ShowColumns` の表示と突き合わせます

**手順5** ④ で値の読み替えを設定する

`TestQuery` に出た設備番号・直区分の**実際の値**を、シートの見出し表記と突き合わせます。
シートが `8020 昼` で DB が `8020` / `1` なら、次のように登録します。

```vba
' BuildShiftMap
AddMap m, "昼", "1"
AddMap m, "夜", "2"
```

値が同じ表記なら登録は不要です（そのまま突き合わせます）。

**手順6** `ImportFromDb` を実行

完了メッセージに「書き込みセル数」と「対応表に無い項目名」が出ます。
書き込みが0なら④の読み替え、項目が抜けていれば③を見直します。

## 4. 動作の仕組み（行位置をハードコードしていません）

判定は **A列の文字（見出し・項目名）だけ**で行い、データ欄の数値は一切参照しません。
そのため、**まだ1件も数値が入っていない空の表**でもそのまま使えます。

1. A列を上から走査し、`LINE_LIST` の設備番号で始まるセル（例 `8020 昼`、`8022 ﾃﾚｽｺ 夜`）を **ブロック見出し**として認識し、
   設備番号と区分に分解します。`LINE_LIST` を空にした場合は「3桁以上の数字で始まる行」で判定します。
2. 見出しの次から、次の見出しまでの行を **その設備・区分の項目行**として扱い、`BuildFieldMap` に載っている項目名の行だけを取り込み対象にします。
3. 日付列は既定（`DAY_COL_MODE = "POSITION"`）では **列の位置**で決めます（B列=1日 … AF列=31日）。
   見出し行の `1〜31` を読ませたい場合だけ `"HEADER"` / `"DATEROW"` に変更してください。
4. その月の日数（28〜31）を年月セルから求め、**存在しない日の列には書き込みません**（`LIMIT_TO_MONTH_END`）。
5. DB の各レコードを `設備番号 | 直区分 | 日 | 列名` のキーで保持し、該当セルへ書き込みます。

そのため、ブロックの追加・行数の違い（8020 は6項目、8021 は4項目 …）や行挿入があっても、
マクロ側の修正なしでそのまま動きます。日付行そのものが空の新規フォーマットで日付も入れたい場合は、
`WRITE_DAY_HEADERS = True` にすると見出し行へ 1〜月末 を書き込みます。

## 5. つまずきやすい点

| 症状 | 対処 |
| --- | --- |
| 「ブロック見出しが見つかりません」 | 対象シートがアクティブか、`SCAN_START_ROW` と `LINE_LIST` の設備番号が実際のA列の表記と合っているか確認 |
| 日付の列が1日ずれる | `FIRST_DATA_COL` を確認（B列始まりなら `2`）。日付行が入っている表なら `DAY_COL_MODE = "HEADER"` でも可 |
| レコード0件 | `TestQuery` で件数と SQL を確認。0件なら年月・テーブル名・日付書式（`DATE_LITERAL_TEMPLATE`）を見直す |
| `[Microsoft][ODBC Driver Manager] データ ソース名および指定された既定のドライバーが見つかりません` | DSN の**ビット数**が Excel と違う。32bit Excel なら 32ビット版アドミニストレーターで DSN を作り直す |
| ログイン／認証エラー | `UID` / `PWD` を確認。DSN 側に保存している場合は接続文字列から外しても可 |
| 日付の比較でエラー・0件 | 上の「日付の書式」の表から、Dr.Sum の日付列の型に合う組み合わせに変更 |
| 一部の行だけ空のまま | メッセージの「対応表に無い項目名」を確認し、`BuildFieldMap` に追加 |
| 値が入らないブロックがある | 完了メッセージの「1件も該当データが無かったブロック」に検索キーが出ます。その値を `TestQuery` の実データと見比べ、`BuildLineMap` / `BuildShiftMap` を調整 |
| パラメータ関連のエラー | 既定の `USE_PARAMETERS = False`（リテラル埋め込み）のままにする。`True` で使う場合に型エラーが出るなら `DATE_PARAM_TYPE` を `adDBTimeStamp` に変更 |
| 数式が消える／消えない | `SKIP_FORMULA_CELLS` を切り替え |

## 6. 想定している DB 側の形

1行 = 1日 × 1設備 × 1直 の縦持ちを想定しています。

| 日付 | 設備番号 | 直区分 | 稼働時間 | 良品数 | TT生産数 | TNGA生産数 | 基準人数 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-01 | 8020 | 昼 | 450 | 576 | 0 | 576 | 2 |
| 2026-07-01 | 8020 | 夜 | 499 | 606 | 30 | 576 | 2 |

Dr.Sum の場合は、Dr.Sum Datalizer / Dr.Sum Administrator 側でこの形のビューを作っておくと確実です。
この形になっていない場合は、`SQL_OVERRIDE` に集計済みのビューや `GROUP BY` 付きの SQL を書けば、
そのまま同じ仕組みで取り込めます（`SELECT` に 日付・設備番号・直区分 と各項目列を含めてください）。
