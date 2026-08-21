Attribute VB_Name = "modDbImport"
Option Explicit

'==================================================================
' modDbImport : DB(ADO/ODBC) → 生産実績シート 取り込み
'   実行 : TestConnection → ShowColumns → TestQuery → ImportFromDb
'   設定 : 下の ①〜⑥ だけ。詳細は README.md
'==================================================================

Private Const adCmdText     As Long = 1
Private Const adParamInput  As Long = 1
Private Const adDate        As Long = 7
Private Const adDBTimeStamp As Long = 135


'================== ① 接続・SQL ==================

' ↓ この1行だけ実環境の値に置き換えてください
Private Const CONN_STR As String = _
    "Provider=MSDASQL;DSN=DSN名;UID=ユーザーID;PWD=パスワード;"

Private Const TABLE_NAME   As String = "V_G2contlrol"
Private Const QUOTE_OPEN   As String = ""        ' 識別子の引用符（Dr.Sumは不要）
Private Const QUOTE_CLOSE  As String = ""
Private Const SQL_OVERRIDE As String = ""        ' 自分でSQLを書く場合（日付条件は ? を2つ）

Private Const USE_PARAMETERS        As Boolean = False
Private Const DATE_FORMAT           As String = "yyyy-mm-dd"
Private Const DATE_LITERAL_TEMPLATE As String = "'<DATE>'"
Private Const DATE_PARAM_TYPE       As Long = adDate
Private Const CMD_TIMEOUT           As Long = 120


'================== ② DBのキー列名 ==================

Private Const FLD_DATE  As String = "LINE_DATE"
Private Const FLD_LINE  As String = "LINE_CD"
Private Const FLD_SHIFT As String = "TYOKUKBN"          ' 1=昼 / 2=夜。無ければ ""

' 稼働時間を 終了-開始 で計算する場合のみ使用（CALC_DURATION 指定時）
Private Const FLD_START         As String = "LINE_START_TIME"
Private Const FLD_END           As String = "LINE_END_TIME"
Private Const FLD_BREAK         As String = ""          ' 休憩(分)の列
Private Const BREAK_MINUTES     As Long = 0             ' 一律で引く分数
Private Const DURATION_UNIT     As String = "MINUTE"    ' "MINUTE" / "HOUR"
Private Const DURATION_DECIMALS As Long = 0
Private Const CALC_DURATION     As String = "<稼働時間=終了-開始>"


'================== ③ シートのレイアウト ==================

Private Const SHEET_NAME     As String = "Sub吸い上げ"
Private Const YEAR_CELL      As String = "A1"
Private Const MONTH_CELL     As String = "B1"
Private Const FIRST_DATA_COL As Long = 2        ' B列 = 1日
Private Const LAST_DATA_COL  As Long = 32       ' AF列 = 31日
Private Const SCAN_START_ROW As Long = 2
Private Const SCAN_END_ROW   As Long = 0        ' 0 = A列の最終行まで

Private Const LINE_LIST           As String = "8020,8021,8022"  ' ブロック見出しの設備番号
Private Const LINE_DIGITS_MIN     As Long = 3
Private Const LINE_CODE_PREFIX    As String = "AS"              ' 8020 → AS8020
Private Const SHIFT_PARTIAL_MATCH As Boolean = True             ' 「ﾃﾚｽｺ昼」→「昼」で判定

Private Const DAY_COL_MODE   As String = "POSITION"  ' "POSITION" / "HEADER" / "DATEROW"
Private Const DAY_HEADER_ROW As Long = 0

Private Const LIMIT_TO_MONTH_END      As Boolean = True
Private Const CLEAR_BEYOND_MONTH_END  As Boolean = False
Private Const WRITE_DAY_HEADERS       As Boolean = False
Private Const SKIP_FORMULA_CELLS      As Boolean = True
Private Const WRITE_ZERO_WHEN_MISSING As Boolean = False
Private Const CLEAR_BEFORE_IMPORT     As Boolean = False
Private Const AGGREGATE_MODE          As String = "LAST"

' 品種別の生産数（「〇〇生産数」の行。無い品種は行を自動追加）
Private Const SPLIT_ENABLED         As Boolean = True
Private Const SPLIT_COLUMN          As String = "SEBAN"
Private Const SPLIT_VALUE_COLUMN    As String = "PRODUCT_CNT"
Private Const PRODUCT_ROW_SUFFIX    As String = "生産数"
Private Const PRODUCT_ROW_ANCHOR    As String = "良品数(個)"
Private Const AUTO_ADD_PRODUCT_ROWS As Boolean = True
Private Const SPLIT_PREFIX          As String = "<品種>"


'================== ④ 項目名 → DB列名 ==================
'   AddCol m, シートの項目名, DB列名, 集計, 絞り込み列, 絞り込み値
'     集計 : SUM / MAX / MIN / COUNT / LAST / FIRST
'     絞り込み値 : カンマ区切り。末尾 * で前方一致、前後 * で部分一致
Private Sub BuildFieldMap(ByVal m As Object)
    AddCol m, "稼働時間", "WORKING_HOURS", "MAX", "", ""
    AddCol m, "良品数(個)", "KAKO_CNT", "SUM", "", ""
    ' AddCol m, "基準人数(最小人数)", "列名", "MAX", "", ""
End Sub


'================== ⑤ 値の読み替え ==================
' シートの表記 → DBに入っている値
Private Sub BuildShiftMap(ByVal m As Object)
    AddMap m, "昼", "1"
    AddMap m, "夜", "2"
    ' AddMap m, "スライダ", "1"
End Sub

Private Sub BuildLineMap(ByVal m As Object)
    ' AddMap m, "8020", "AS8046"      ' LINE_CODE_PREFIX で足りない場合だけ
End Sub


'================== ⑥ 品種の表示名 ==================
' DBの品種コード → 行名に使う表示名（未登録はコードをそのまま行名にする）
Private Sub BuildProductMap(ByVal m As Object)
    ' AddMap m, "TMC300D", "TT"
End Sub


'==================================================================
'  ここから下は通常編集不要
'==================================================================

'------------------------------------------------------------------
' メイン : DBから取り込む
'------------------------------------------------------------------
Public Sub ImportFromDb()
    Dim ws As Worksheet
    Dim fieldMap As Object, shiftMap As Object, lineMap As Object, productMap As Object
    Dim splits As Object
    Dim addedRows As Long
    Dim blocks As Collection, unknownLabels As Collection, emptyBlocks As Collection
    Dim cache As Object
    Dim yy As Long, mm As Long
    Dim dFrom As Date, dTo As Date
    Dim recCount As Long, writeCount As Long, skipFormula As Long, missCount As Long
    Dim monthDays As Long
    Dim errNum As Long, errDesc As String
    Dim calcMode As XlCalculation
    Dim restored As Boolean

    On Error GoTo ErrHandler

    Set ws = GetTargetSheet()

    yy = ReadYear(ws.Range(YEAR_CELL))
    mm = ReadMonth(ws.Range(MONTH_CELL))
    If yy < 1900 Or yy > 2999 Then
        Err.Raise vbObjectError + 1, , "年セル(" & YEAR_CELL & ")から年を読み取れませんでした。"
    End If
    If mm < 1 Or mm > 12 Then
        Err.Raise vbObjectError + 2, , "月セル(" & MONTH_CELL & ")から月を読み取れませんでした。"
    End If
    dFrom = DateSerial(yy, mm, 1)
    dTo = DateSerial(yy, mm + 1, 1)
    monthDays = Day(dTo - 1)                 ' その月の日数（28〜31）

    Set fieldMap = NewDict(): BuildFieldMap fieldMap
    Set shiftMap = NewDict(): BuildShiftMap shiftMap
    Set lineMap = NewDict(): BuildLineMap lineMap
    Set productMap = NewDict(): BuildProductMap productMap
    Set splits = NewDict()
    If fieldMap.Count = 0 Then
        Err.Raise vbObjectError + 3, , "BuildFieldMap に項目が登録されていません。"
    End If

    Set unknownLabels = New Collection
    Set emptyBlocks = New Collection
    Set blocks = ScanLayout(ws, fieldMap, unknownLabels)
    If blocks.Count = 0 Then
        Err.Raise vbObjectError + 4, , "A列にブロック見出し（例: 8020 昼）が見つかりませんでした。" & vbCrLf & _
                                        "SCAN_START_ROW / シート指定をご確認ください。"
    End If

    Set cache = FetchData(dFrom, dTo, fieldMap, productMap, splits, recCount)

    Application.ScreenUpdating = False
    calcMode = Application.Calculation
    Application.Calculation = xlCalculationManual

    ' シートに無い品種の行を追加してから、行位置を取り直す
    If SPLIT_ENABLED And AUTO_ADD_PRODUCT_ROWS Then
        addedRows = EnsureProductRows(ws, blocks, splits, shiftMap, lineMap)
        If addedRows > 0 Then Set blocks = ScanLayout(ws, fieldMap, unknownLabels)
    End If

    If WRITE_DAY_HEADERS Then WriteDayHeaders ws, blocks, monthDays
    If CLEAR_BEFORE_IMPORT Then ClearBlocks ws, blocks, monthDays

    WriteBlocks ws, blocks, cache, shiftMap, lineMap, monthDays, _
                writeCount, skipFormula, missCount, emptyBlocks

    Application.Calculation = calcMode
    Application.ScreenUpdating = True
    restored = True

    MsgBox BuildReport(yy, mm, monthDays, blocks, recCount, writeCount, skipFormula, missCount, _
                       addedRows, unknownLabels, emptyBlocks), _
           vbInformation, "DB取り込み完了"
    Exit Sub

ErrHandler:
    errNum = Err.Number: errDesc = Err.Description      ' ← 先に退避（On Error で消えるため）
    If Not restored Then
        On Error Resume Next
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        On Error GoTo 0
    End If
    MsgBox "取り込みに失敗しました。" & vbCrLf & vbCrLf & _
           "エラー " & errNum & " : " & errDesc, vbCritical, "DB取り込み"
End Sub

'------------------------------------------------------------------
' 接続テスト（設定確認用）
'------------------------------------------------------------------
Public Sub TestConnection()
    Dim cn As Object
    On Error GoTo ErrHandler
    Set cn = CreateObject("ADODB.Connection")
    cn.Open CONN_STR
    cn.Close
    MsgBox "接続に成功しました。", vbInformation, "接続テスト"
    Exit Sub
ErrHandler:
    MsgBox "接続に失敗しました。" & vbCrLf & vbCrLf & _
           "エラー " & Err.Number & " : " & Err.Description & vbCrLf & vbCrLf & _
           "接続文字列 : " & MaskPassword(CONN_STR), vbCritical, "接続テスト"
End Sub

'------------------------------------------------------------------
' テーブル／ビュー一覧 : 接続先で参照できる名前を表示する
'   「テーブルがありません」と言われたときに、正しい名前を確認するため
'   結果はイミディエイト ウィンドウ（Ctrl+G）にも全件出力します
'------------------------------------------------------------------
Public Sub ShowTables()
    Const adSchemaTables As Long = 20
    Const MAX_SHOW As Long = 60

    Dim cn As Object, rs As Object
    Dim msg As String, nm As String, typ As String, cat As String, sch As String
    Dim full As String, n As Long, shown As Long
    Dim errNum As Long, errDesc As String

    On Error GoTo ErrHandler

    Set cn = CreateObject("ADODB.Connection")
    cn.CommandTimeout = CMD_TIMEOUT
    cn.Open CONN_STR

    Set rs = cn.OpenSchema(adSchemaTables)

    Do Until rs.EOF
        nm = NzStr(rs.Fields("TABLE_NAME").Value)
        typ = NzStr(rs.Fields("TABLE_TYPE").Value)
        cat = NzStr(rs.Fields("TABLE_CATALOG").Value)
        sch = NzStr(rs.Fields("TABLE_SCHEMA").Value)

        If UCase$(typ) <> "SYSTEM TABLE" And Len(nm) > 0 Then
            full = nm
            If Len(sch) > 0 Then full = sch & "." & full
            If Len(cat) > 0 Then full = cat & "." & full

            n = n + 1
            Debug.Print n & vbTab & typ & vbTab & full
            If shown < MAX_SHOW Then
                msg = msg & full & "   [" & typ & "]" & vbCrLf
                shown = shown + 1
            End If
        End If
        rs.MoveNext
    Loop

    rs.Close
    cn.Close

    MsgBox "参照できるテーブル／ビュー : " & n & " 件" & vbCrLf & _
           "（全件はイミディエイト ウィンドウ Ctrl+G に出力しました）" & vbCrLf & vbCrLf & _
           msg & IIf(n > shown, "…ほか " & (n - shown) & " 件", ""), _
           vbInformation, "テーブル一覧"
    Exit Sub

ErrHandler:
    errNum = Err.Number: errDesc = Err.Description
    On Error Resume Next
    If Not rs Is Nothing Then If rs.State <> 0 Then rs.Close
    If Not cn Is Nothing Then If cn.State <> 0 Then cn.Close
    On Error GoTo 0
    MsgBox "一覧を取得できませんでした。" & vbCrLf & vbCrLf & _
           "エラー " & errNum & " : " & errDesc, vbCritical, "テーブル一覧"
End Sub

'------------------------------------------------------------------
' 列一覧の確認 : TABLE_NAME の列名と、先頭1件の値を表示する
'   接続できたら最初にこれを実行し、②③④の設定に写してください
'------------------------------------------------------------------
Public Sub ShowColumns()
    Const adOpenForwardOnly As Long = 0
    Const adLockReadOnly As Long = 1

    Dim cn As Object, rs As Object
    Dim msg As String, i As Long
    Dim errNum As Long, errDesc As String

    On Error GoTo ErrHandler

    Set cn = CreateObject("ADODB.Connection")
    cn.CommandTimeout = CMD_TIMEOUT
    cn.Open CONN_STR

    Set rs = CreateObject("ADODB.Recordset")
    rs.Open "SELECT * FROM " & TABLE_NAME, cn, adOpenForwardOnly, adLockReadOnly

    msg = "テーブル : " & TABLE_NAME & "（" & rs.Fields.Count & " 列）" & vbCrLf & vbCrLf
    msg = msg & "列名  =  先頭1件の値" & vbCrLf
    msg = msg & String(40, "-") & vbCrLf

    For i = 0 To rs.Fields.Count - 1
        msg = msg & rs.Fields(i).Name
        If Not rs.EOF Then msg = msg & "  =  " & NzStr(rs.Fields(i).Value)
        msg = msg & vbCrLf
    Next i

    If rs.EOF Then msg = msg & vbCrLf & "※ データが0件のため値は表示していません。"

    rs.Close
    cn.Close
    MsgBox msg, vbInformation, "列一覧"
    Exit Sub

ErrHandler:
    errNum = Err.Number: errDesc = Err.Description      ' ← 先に退避（On Error で消えるため）
    On Error Resume Next
    If Not rs Is Nothing Then If rs.State <> 0 Then rs.Close
    If Not cn Is Nothing Then If cn.State <> 0 Then cn.Close
    On Error GoTo 0
    MsgBox "エラー " & errNum & " : " & errDesc & vbCrLf & vbCrLf & _
           "接続文字列 : " & MaskPassword(CONN_STR) & vbCrLf & _
           "TABLE_NAME（" & TABLE_NAME & "）が正しいか確認してください。", vbCritical, "列一覧"
End Sub

'------------------------------------------------------------------
' データの中身を確認 : 日付の範囲・設備コード・直区分・品種の実際の値
'   件数0のときや、変換設定を決めるときに使います
'------------------------------------------------------------------
Public Sub ShowDataSummary()
    Dim cn As Object, msg As String
    Dim errNum As Long, errDesc As String

    On Error GoTo ErrHandler

    Set cn = CreateObject("ADODB.Connection")
    cn.CommandTimeout = CMD_TIMEOUT
    cn.Open CONN_STR

    msg = "テーブル : " & TABLE_NAME & vbCrLf & vbCrLf
    msg = msg & "■ 全件数" & vbCrLf
    msg = msg & QueryText(cn, "SELECT COUNT(*) AS CNT FROM " & TABLE_NAME) & vbCrLf
    msg = msg & vbCrLf & "■ 日付の範囲" & vbCrLf
    msg = msg & QueryText(cn, "SELECT MIN(" & Q(FLD_DATE) & ") AS D_MIN FROM " & TABLE_NAME) & _
                "  〜  " & _
                QueryText(cn, "SELECT MAX(" & Q(FLD_DATE) & ") AS D_MAX FROM " & TABLE_NAME) & vbCrLf

    msg = msg & vbCrLf & "■ " & FLD_LINE & " の値" & vbCrLf
    msg = msg & DistinctText(cn, FLD_LINE, 30) & vbCrLf

    If Len(FLD_SHIFT) > 0 Then
        msg = msg & vbCrLf & "■ " & FLD_SHIFT & " の値" & vbCrLf
        msg = msg & DistinctText(cn, FLD_SHIFT, 10) & vbCrLf
    End If

    If SPLIT_ENABLED Then
        msg = msg & vbCrLf & "■ " & SPLIT_COLUMN & " の値（品種）" & vbCrLf
        msg = msg & DistinctText(cn, SPLIT_COLUMN, 30) & vbCrLf
    End If

    cn.Close
    MsgBox msg, vbInformation, "データの概要"
    Exit Sub

ErrHandler:
    errNum = Err.Number: errDesc = Err.Description
    On Error Resume Next
    If Not cn Is Nothing Then If cn.State <> 0 Then cn.Close
    On Error GoTo 0
    MsgBox "エラー " & errNum & " : " & errDesc, vbCritical, "データの概要"
End Sub

' 1行だけのSQLを実行して「値 / 値 / 値」の形で返す
Private Function QueryText(ByVal cn As Object, ByVal sql As String) As String
    Dim rs As Object, i As Long, t As String
    On Error GoTo Failed
    Set rs = cn.Execute(sql)
    If rs Is Nothing Then
        QueryText = "(結果が返りませんでした)"
        Exit Function
    End If
    If rs.State = 0 Then
        QueryText = "(結果が返りませんでした)"
        Exit Function
    End If
    If Not rs.EOF Then
        For i = 0 To rs.Fields.Count - 1
            If i > 0 Then t = t & "  /  "
            t = t & NzStr(rs.Fields(i).Value)
        Next i
    End If
    rs.Close
    QueryText = t
    Exit Function
Failed:
    QueryText = "(取得できませんでした: " & Err.Description & ")"
End Function

' 指定列の値を重複なしで取り出す
Private Function DistinctText(ByVal cn As Object, ByVal colName As String, _
                              ByVal maxCount As Long) As String
    Dim rs As Object, t As String, n As Long
    On Error GoTo Failed
    Set rs = cn.Execute("SELECT DISTINCT " & Q(colName) & " FROM " & TABLE_NAME)
    If rs Is Nothing Then
        DistinctText = "(結果が返りませんでした)"
        Exit Function
    End If
    If rs.State = 0 Then
        DistinctText = "(結果が返りませんでした)"
        Exit Function
    End If
    Do Until rs.EOF
        n = n + 1
        If n <= maxCount Then
            If Len(t) > 0 Then t = t & ", "
            t = t & NzStr(rs.Fields(0).Value)
        End If
        rs.MoveNext
    Loop
    rs.Close
    If n > maxCount Then t = t & " …ほか " & (n - maxCount) & " 種"
    If n = 0 Then t = "(データなし)"
    DistinctText = t
    Exit Function
Failed:
    DistinctText = "(取得できませんでした: " & Err.Description & ")"
End Function

'------------------------------------------------------------------
' 実行されるSQLを確認する
'------------------------------------------------------------------
Public Sub ShowGeneratedSql()
    Dim fieldMap As Object, dFrom As Date, dTo As Date

    Set fieldMap = NewDict(): BuildFieldMap fieldMap
    GetPeriod dFrom, dTo
    MsgBox EffectiveSql(BuildSql(fieldMap), dFrom, dTo), vbInformation, "生成されるSQL"
End Sub

'------------------------------------------------------------------
' 試し取得 : シートには書き込まず、件数と先頭数件の中身を表示する
'   Dr.Sum の接続・SQL・日付書式の確認に使ってください
'------------------------------------------------------------------
Public Sub TestQuery()
    Const PREVIEW_ROWS As Long = 3
    Const MAX_ROWS As Long = 5000

    Dim fieldMap As Object, cn As Object, rs As Object
    Dim sql As String, msg As String, body As String, stage As String
    Dim dFrom As Date, dTo As Date
    Dim n As Long, i As Long
    Dim errNum As Long, errDesc As String

    On Error GoTo ErrHandler

    stage = "設定の読み取り（年月セル・項目対応）"
    Set fieldMap = NewDict(): BuildFieldMap fieldMap
    GetPeriod dFrom, dTo
    sql = BuildSql(fieldMap)

    stage = "DBへの接続"
    Set cn = CreateObject("ADODB.Connection")
    cn.CommandTimeout = CMD_TIMEOUT
    cn.Open CONN_STR

    stage = "SQLの実行"
    Set rs = ExecuteQuery(cn, sql, dFrom, dTo)

    stage = "データの読み取り"

    Do Until rs.EOF
        n = n + 1
        If n <= PREVIEW_ROWS Then
            body = body & "【" & n & "件目】" & vbCrLf
            For i = 0 To rs.Fields.Count - 1
                body = body & "  " & rs.Fields(i).Name & " = " & NzStr(rs.Fields(i).Value) & vbCrLf
            Next i
            body = body & "  → 日 = " & ParseDayNumber(rs.Fields(FLD_DATE).Value)
            If UsesCalcDuration(fieldMap) Then
                body = body & " / 稼働時間(計算) = " & NzStr(CalcDuration(rs))
            End If
            body = body & vbCrLf & vbCrLf
        End If
        If n >= MAX_ROWS Then Exit Do
        rs.MoveNext
    Loop

    rs.Close
    cn.Close

    msg = "取得件数 : " & n & " 件"
    If n >= MAX_ROWS Then msg = msg & "（" & MAX_ROWS & " 件で打ち切り）"
    msg = msg & vbCrLf & vbCrLf & body
    msg = msg & "SQL:" & vbCrLf & EffectiveSql(sql, dFrom, dTo)
    MsgBox msg, vbInformation, "試し取得"
    Exit Sub

ErrHandler:
    errNum = Err.Number: errDesc = Err.Description      ' ← 先に退避（On Error で消えるため）
    On Error Resume Next
    If Not rs Is Nothing Then If rs.State <> 0 Then rs.Close
    If Not cn Is Nothing Then If cn.State <> 0 Then cn.Close
    On Error GoTo 0

    msg = "【" & stage & "】でエラーが発生しました。" & vbCrLf & vbCrLf
    msg = msg & "エラー " & errNum & " : " & errDesc & vbCrLf & vbCrLf
    If errNum = 0 And Len(errDesc) = 0 Then
        msg = msg & "（エラー内容が取得できませんでした。VBEの「ツール → オプション → 全般」で" & vbCrLf & _
                    "　「エラー トラップ = エラー発生時に中断」にして再実行すると、" & vbCrLf & _
                    "　止まった行が特定できます）" & vbCrLf & vbCrLf
    End If
    msg = msg & "接続文字列 : " & MaskPassword(CONN_STR) & vbCrLf & vbCrLf
    If Len(sql) > 0 Then msg = msg & "SQL:" & vbCrLf & EffectiveSql(sql, dFrom, dTo)
    MsgBox msg, vbCritical, "試し取得"
End Sub

' メッセージ表示用にパスワードを伏せる
Private Function MaskPassword(ByVal connStr As String) As String
    Dim parts() As String, i As Long, kv As String, key As String
    parts = Split(connStr, ";")
    For i = LBound(parts) To UBound(parts)
        kv = parts(i)
        key = UCase$(Trim$(Split(kv, "=")(0)))
        If key = "PWD" Or key = "PASSWORD" Then
            If InStr(kv, "=") > 0 Then parts(i) = Left$(kv, InStr(kv, "=")) & "****"
        End If
    Next i
    MaskPassword = Join(parts, ";")
End Function

'------------------------------------------------------------------
' 取り込み対象欄のクリア（数式セルは残す）
'------------------------------------------------------------------
Public Sub ClearImportArea()
    Dim ws As Worksheet, fieldMap As Object, blocks As Collection, dummy As Collection
    On Error GoTo ErrHandler

    Set ws = GetTargetSheet()
    Set fieldMap = NewDict(): BuildFieldMap fieldMap
    Set dummy = New Collection
    Set blocks = ScanLayout(ws, fieldMap, dummy)
    If blocks.Count = 0 Then
        MsgBox "対象ブロックが見つかりませんでした。", vbExclamation
        Exit Sub
    End If
    If MsgBox(blocks.Count & " ブロックのデータ欄をクリアします。よろしいですか？", _
              vbQuestion + vbYesNo, "クリア") <> vbYes Then Exit Sub

    Application.ScreenUpdating = False
    ClearBlocks ws, blocks, 31
    Application.ScreenUpdating = True
    MsgBox "クリアしました。", vbInformation
    Exit Sub
ErrHandler:
    Application.ScreenUpdating = True
    MsgBox "エラー " & Err.Number & " : " & Err.Description, vbCritical
End Sub


'==================== レイアウト解析 ====================

' シートA列を走査して「ブロック（設備×直）」と「項目行」を洗い出す
Private Function ScanLayout(ByVal ws As Worksheet, ByVal fieldMap As Object, _
                            ByVal unknownLabels As Collection) As Collection
    Dim blocks As Collection, blk As Object, items As Object
    Dim r As Long, lastRow As Long
    Dim raw As String, key As String
    Dim lineRaw As String, shiftRaw As String
    Dim defaultDays As Object

    Set blocks = New Collection
    Set defaultDays = Nothing

    lastRow = SCAN_END_ROW
    If lastRow <= 0 Then lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    If lastRow < SCAN_START_ROW Then
        Set ScanLayout = blocks
        Exit Function
    End If

    Set blk = Nothing
    For r = SCAN_START_ROW To lastRow
        raw = CellText(ws.Cells(r, 1))
        key = NormText(raw)
        If Len(key) > 0 Then
            If ParseHeader(key, lineRaw, shiftRaw) Then
                Set blk = NewDict()
                blk("row") = r
                blk("line") = lineRaw
                blk("shift") = shiftRaw
                blk("title") = Trim$(raw)
                Set blk("items") = NewDict()      ' key: 行番号(文字列) → DB列名
                Set blk("days") = BuildDayMap(ws, r, defaultDays)
                blocks.Add blk
            ElseIf Not blk Is Nothing Then
                If fieldMap.Exists(key) Then
                    Set items = blk("items")
                    items(CStr(r)) = fieldMap(key)
                ElseIf IsProductRow(key) Then
                    Set items = blk("items")
                    items(CStr(r)) = SPLIT_PREFIX & ProductNameOfRow(key)
                Else
                    AddUnique unknownLabels, Trim$(raw)
                End If
            End If
        End If
    Next r

    Set ScanLayout = blocks
End Function

' 「〇〇生産数」の行か（品種別の行）
Private Function IsProductRow(ByVal key As String) As Boolean
    Dim suf As String
    If Not SPLIT_ENABLED Then Exit Function
    suf = NormText(PRODUCT_ROW_SUFFIX)
    If Len(suf) = 0 Or Len(key) <= Len(suf) Then Exit Function
    IsProductRow = (StrComp(Right$(key, Len(suf)), suf, vbTextCompare) = 0)
End Function

' 「TT生産数」→「TT」
Private Function ProductNameOfRow(ByVal key As String) As String
    ProductNameOfRow = Left$(key, Len(key) - Len(NormText(PRODUCT_ROW_SUFFIX)))
End Function

' 見出し行か判定し、設備番号と区分に分解する（例: "8020昼" → "8020","昼"）
'   判定はA列の文字だけで行うため、データ欄が空でも動作します。
Private Function ParseHeader(ByVal key As String, ByRef lineRaw As String, _
                             ByRef shiftRaw As String) As Boolean
    Dim i As Long, ch As String
    Dim codes() As String, code As String, n As Long

    lineRaw = "": shiftRaw = ""

    ' ① LINE_LIST が指定されていれば、その設備番号で始まる行だけを見出しとする
    If Len(Trim$(LINE_LIST)) > 0 Then
        codes = Split(LINE_LIST, ",")
        For n = LBound(codes) To UBound(codes)
            code = NormText(codes(n))
            If Len(code) > 0 Then
                If Left$(key, Len(code)) = code Then
                    lineRaw = code
                    shiftRaw = Mid$(key, Len(code) + 1)
                    ParseHeader = True
                    Exit Function
                End If
            End If
        Next n
        Exit Function
    End If

    ' ② LINE_LIST が空のときは「先頭の数字並び」を設備番号とみなす
    i = 1
    Do While i <= Len(key)
        ch = Mid$(key, i, 1)
        If ch < "0" Or ch > "9" Then Exit Do
        i = i + 1
    Loop

    If i = 1 Then Exit Function                  ' 先頭が数字でない → 項目名行
    If i - 1 < LINE_DIGITS_MIN Then Exit Function ' 桁数が足りない → 見出しとみなさない

    lineRaw = Left$(key, i - 1)
    shiftRaw = Mid$(key, i)
    ParseHeader = True
End Function

' 日付(1〜31)とシート列の対応表を作る
'   既定( DAY_COL_MODE = "POSITION" )は列の位置だけで決めるため、
'   表にデータや日付が一切入っていなくても正しく対応します。
Private Function BuildDayMap(ByVal ws As Worksheet, ByVal headerRow As Long, _
                             ByRef cachedDays As Object) As Object
    Dim mode As String, d As Object

    mode = UCase$(Trim$(DAY_COL_MODE))

    If mode = "HEADER" Then
        Set d = ReadDayNumbers(ws, headerRow)
        If d.Count > 0 Then
            Set BuildDayMap = d
            Exit Function
        End If

    ElseIf mode = "DATEROW" Then
        If cachedDays Is Nothing And DAY_HEADER_ROW > 0 Then
            Set cachedDays = ReadDayNumbers(ws, DAY_HEADER_ROW)
        End If
        If Not cachedDays Is Nothing Then
            If cachedDays.Count > 0 Then
                Set BuildDayMap = cachedDays
                Exit Function
            End If
        End If
    End If

    ' POSITION（既定）／読み取れなかった場合のフォールバック
    Set BuildDayMap = PositionDayMap()
End Function

' 列の位置から 列→日 を作る（FIRST_DATA_COL = 1日）
Private Function PositionDayMap() As Object
    Dim d As Object, c As Long, n As Long
    Set d = NewDict()
    For c = FIRST_DATA_COL To LAST_DATA_COL
        n = c - FIRST_DATA_COL + 1
        If n >= 1 And n <= 31 Then d(CStr(c)) = n
    Next c
    Set PositionDayMap = d
End Function

' 指定行に入っている 1〜31 の数字（または日付）を読んで 列→日 を作る
Private Function ReadDayNumbers(ByVal ws As Worksheet, ByVal rowNo As Long) As Object
    Dim d As Object, c As Long, v As Variant, n As Long

    Set d = NewDict()
    If rowNo <= 0 Then
        Set ReadDayNumbers = d
        Exit Function
    End If

    For c = FIRST_DATA_COL To LAST_DATA_COL
        v = ws.Cells(rowNo, c).Value
        If Not IsError(v) And Not IsEmpty(v) Then
            n = 0
            If IsDate(v) Then
                n = Day(CDate(v))
            ElseIf IsNumeric(v) Then
                n = CLng(v)
            End If
            If n >= 1 And n <= 31 Then d(CStr(c)) = n
        End If
    Next c

    Set ReadDayNumbers = d
End Function

'==================== DB取得 ====================

' 取得結果を  設備|直|日|DB列名 → 値  のディクショナリに詰める
Private Function FetchData(ByVal dFrom As Date, ByVal dTo As Date, _
                           ByVal fieldMap As Object, ByVal productMap As Object, _
                           ByVal splits As Object, ByRef recCount As Long) As Object
    Dim cn As Object, rs As Object
    Dim specs As Object, cache As Object
    Dim sql As String, k As Variant, spec As String
    Dim lineKey As String, shiftKey As String, keyBase As String, cellKey As String
    Dim dv As Variant, val As Variant
    Dim dayNo As Long
    Dim prodRaw As String, prodName As String, prodKey As String, blockKey As String
    Dim prodList As Object

    Set specs = UniqueSpecs(fieldMap)
    Set cache = NewDict()
    recCount = 0

    sql = BuildSql(fieldMap)

    Set cn = CreateObject("ADODB.Connection")
    cn.CommandTimeout = CMD_TIMEOUT
    cn.Open CONN_STR

    On Error GoTo CleanFail

    Set rs = ExecuteQuery(cn, sql, dFrom, dTo)

    Do Until rs.EOF
        dv = rs.Fields(FLD_DATE).Value
        dayNo = ParseDayNumber(dv)
        If dayNo > 0 Then

            lineKey = NormText(NzStr(rs.Fields(FLD_LINE).Value))
            If Len(FLD_SHIFT) > 0 Then
                shiftKey = NormText(NzStr(rs.Fields(FLD_SHIFT).Value))
            Else
                shiftKey = ""
            End If
            keyBase = lineKey & "|" & shiftKey & "|" & CStr(dayNo) & "|"

            For Each k In specs.Keys
                spec = CStr(k)
                If SpecMatches(spec, rs) Then
                    If IsCalcColumn(SpecPart(spec, 0)) Then
                        val = CalcDuration(rs)
                    Else
                        val = rs.Fields(SpecPart(spec, 0)).Value
                    End If
                    If Not IsNull(val) Then
                        Accumulate cache, keyBase & spec, val, SpecPart(spec, 1)
                    End If
                End If
            Next k
            ' 品種ごとの生産数を合計し、出てきた品種を記録する
            If SPLIT_ENABLED Then
                prodRaw = NzStr(rs.Fields(SPLIT_COLUMN).Value)
                If Len(Trim$(prodRaw)) > 0 Then
                    prodName = MapValue(productMap, prodRaw)
                    prodKey = NormText(prodName)
                    val = rs.Fields(SPLIT_VALUE_COLUMN).Value
                    If Not IsNull(val) Then
                        Accumulate cache, keyBase & SPLIT_PREFIX & prodKey, val, "SUM"
                    End If

                    blockKey = lineKey & "|" & shiftKey
                    If Not splits.Exists(blockKey) Then Set splits(blockKey) = NewDict()
                    Set prodList = splits(blockKey)
                    prodList(prodKey) = prodName
                End If
            End If

            recCount = recCount + 1
        End If
        rs.MoveNext
    Loop

    rs.Close
    cn.Close
    Set FetchData = cache
    Exit Function

CleanFail:
    Dim errNum As Long, errDesc As String
    errNum = Err.Number: errDesc = Err.Description
    On Error Resume Next
    If Not rs Is Nothing Then If rs.State <> 0 Then rs.Close
    If Not cn Is Nothing Then If cn.State <> 0 Then cn.Close
    On Error GoTo 0
    Err.Raise errNum, , errDesc & vbCrLf & vbCrLf & "SQL: " & EffectiveSql(sql, dFrom, dTo)
End Function

' 集計方法にしたがって値を積み上げる
Private Sub Accumulate(ByVal cache As Object, ByVal key As String, ByVal val As Variant, _
                       ByVal agg As String)
    Select Case agg
        Case "SUM"
            If cache.Exists(key) Then
                If IsNumeric(val) And IsNumeric(cache(key)) Then
                    cache(key) = CDbl(cache(key)) + CDbl(val)
                Else
                    cache(key) = val
                End If
            Else
                cache(key) = val
            End If

        Case "MAX"
            If cache.Exists(key) Then
                If IsNumeric(val) And IsNumeric(cache(key)) Then
                    If CDbl(val) > CDbl(cache(key)) Then cache(key) = val
                Else
                    cache(key) = val
                End If
            Else
                cache(key) = val
            End If

        Case "MIN"
            If cache.Exists(key) Then
                If IsNumeric(val) And IsNumeric(cache(key)) Then
                    If CDbl(val) < CDbl(cache(key)) Then cache(key) = val
                Else
                    cache(key) = val
                End If
            Else
                cache(key) = val
            End If

        Case "COUNT"
            If cache.Exists(key) Then
                cache(key) = CDbl(cache(key)) + 1
            Else
                cache(key) = 1
            End If

        Case "FIRST"
            If Not cache.Exists(key) Then cache(key) = val

        Case Else       ' LAST
            cache(key) = val
    End Select
End Sub

' コマンドを組み立てて実行し、レコードセットを返す
Private Function ExecuteQuery(ByVal cn As Object, ByVal sql As String, _
                              ByVal dFrom As Date, ByVal dTo As Date) As Object
    Dim cmd As Object

    Set cmd = CreateObject("ADODB.Command")
    Set cmd.ActiveConnection = cn
    cmd.CommandType = adCmdText
    cmd.CommandTimeout = CMD_TIMEOUT

    If USE_PARAMETERS Then
        cmd.CommandText = sql
        cmd.Parameters.Append cmd.CreateParameter("pFrom", DATE_PARAM_TYPE, adParamInput, 0, dFrom)
        cmd.Parameters.Append cmd.CreateParameter("pTo", DATE_PARAM_TYPE, adParamInput, 0, dTo)
    Else
        cmd.CommandText = InlineDates(sql, dFrom, dTo)
    End If

    Set ExecuteQuery = cmd.Execute
End Function

' 実際にDBへ渡るSQL（表示・エラーメッセージ用）
Private Function EffectiveSql(ByVal sql As String, ByVal dFrom As Date, ByVal dTo As Date) As String
    If USE_PARAMETERS Then
        EffectiveSql = sql
    Else
        EffectiveSql = InlineDates(sql, dFrom, dTo)
    End If
End Function

' SQL文の組み立て
Private Function BuildSql(ByVal fieldMap As Object) As String
    Dim cols As Object, sel As Object, k As Variant, sql As String

    If Len(Trim$(SQL_OVERRIDE)) > 0 Then
        BuildSql = SQL_OVERRIDE
        Exit Function
    End If

    Set cols = CollectColumns(fieldMap)
    Set sel = NewDict()

    AddSelect sel, FLD_DATE
    AddSelect sel, FLD_LINE
    AddSelect sel, FLD_SHIFT

    For Each k In cols.Keys
        AddSelect sel, CStr(k)
    Next k

    ' 稼働時間を計算する場合は、開始・終了（と休憩）も取得する
    If UsesCalcDuration(fieldMap) Then
        If Len(FLD_START) = 0 Or Len(FLD_END) = 0 Then
            Err.Raise vbObjectError + 30, , "稼働時間の計算には FLD_START / FLD_END の設定が必要です。"
        End If
        AddSelect sel, FLD_START
        AddSelect sel, FLD_END
        AddSelect sel, FLD_BREAK
    End If

    For Each k In sel.Keys
        If Len(sql) > 0 Then sql = sql & ", "
        sql = sql & Q(CStr(k))
    Next k

    BuildSql = "SELECT " & sql & " FROM " & TABLE_NAME & _
               " WHERE " & Q(FLD_DATE) & " >= ? AND " & Q(FLD_DATE) & " < ?"
End Function

' SELECT に列を追加（空文字と重複は無視）
Private Sub AddSelect(ByVal sel As Object, ByVal colName As String)
    If Len(colName) = 0 Then Exit Sub
    If Not sel.Exists(colName) Then sel(colName) = 1
End Sub

' 計算で求める疑似列か
Private Function IsCalcColumn(ByVal colName As String) As Boolean
    IsCalcColumn = (colName = CALC_DURATION)
End Function

' 項目対応の中で稼働時間の計算を使っているか
Private Function UsesCalcDuration(ByVal fieldMap As Object) As Boolean
    Dim k As Variant
    For Each k In fieldMap.Keys
        If IsCalcColumn(SpecPart(CStr(fieldMap(k)), 0)) Then
            UsesCalcDuration = True
            Exit Function
        End If
    Next k
End Function

' ? を日付リテラルに置き換える（USE_PARAMETERS = False 用）
Private Function InlineDates(ByVal sql As String, ByVal dFrom As Date, ByVal dTo As Date) As String
    Dim p As Long, s As String
    s = sql
    p = InStr(s, "?")
    If p > 0 Then
        s = Left$(s, p - 1) & DateLiteral(dFrom) & Mid$(s, p + 1)
        p = InStr(s, "?")
        If p > 0 Then
            s = Left$(s, p - 1) & DateLiteral(dTo) & Mid$(s, p + 1)
        End If
    End If
    InlineDates = s
End Function

' 日付1つ分のリテラルを作る
Private Function DateLiteral(ByVal d As Date) As String
    DateLiteral = Replace(DATE_LITERAL_TEMPLATE, "<DATE>", Format$(d, DATE_FORMAT))
End Function

' 取得が必要なDB列（データ列＋絞り込み列。計算用の疑似列は除く）
Private Function CollectColumns(ByVal fieldMap As Object) As Object
    Dim cols As Object, k As Variant, spec As String
    Set cols = NewDict()
    For Each k In fieldMap.Keys
        spec = CStr(fieldMap(k))
        If Not IsCalcColumn(SpecPart(spec, 0)) Then
            If Len(SpecPart(spec, 0)) > 0 Then cols(SpecPart(spec, 0)) = 1
        End If
        If Len(SpecPart(spec, 2)) > 0 Then cols(SpecPart(spec, 2)) = 1
    Next k

    If SPLIT_ENABLED Then
        If Len(SPLIT_COLUMN) > 0 Then cols(SPLIT_COLUMN) = 1
        If Len(SPLIT_VALUE_COLUMN) > 0 Then cols(SPLIT_VALUE_COLUMN) = 1
    End If

    Set CollectColumns = cols
End Function

' 項目ごとの仕様（重複除去）
Private Function UniqueSpecs(ByVal fieldMap As Object) As Object
    Dim specs As Object, k As Variant
    Set specs = NewDict()
    For Each k In fieldMap.Keys
        specs(CStr(fieldMap(k))) = 1
    Next k
    Set UniqueSpecs = specs
End Function

Private Function Q(ByVal colName As String) As String
    If Len(QUOTE_OPEN) = 0 Then
        Q = colName
    Else
        Q = QUOTE_OPEN & colName & QUOTE_CLOSE
    End If
End Function


'==================== シート書き込み ====================

Private Sub WriteBlocks(ByVal ws As Worksheet, ByVal blocks As Collection, ByVal cache As Object, _
                        ByVal shiftMap As Object, ByVal lineMap As Object, ByVal monthDays As Long, _
                        ByRef writeCount As Long, ByRef skipFormula As Long, ByRef missCount As Long, _
                        ByVal emptyBlocks As Collection)
    Dim blk As Object, items As Object, days As Object
    Dim rKey As Variant, cKey As Variant
    Dim r As Long, c As Long, dayNo As Long
    Dim dbCol As String, keyBase As String, cellKey As String
    Dim lineVal As String, shiftVal As String
    Dim cel As Range
    Dim blockHits As Long

    For Each blk In blocks
        Set items = blk("items")
        Set days = blk("days")
        If items.Count > 0 Then
            lineVal = MapLine(lineMap, CStr(blk("line")))
            If Len(FLD_SHIFT) > 0 Then
                shiftVal = MapShift(shiftMap, CStr(blk("shift")))
            Else
                shiftVal = ""
            End If
            keyBase = NormText(lineVal) & "|" & NormText(shiftVal) & "|"
            blockHits = 0

            For Each rKey In items.Keys
                r = CLng(rKey)
                dbCol = CStr(items(rKey))
                For Each cKey In days.Keys
                    c = CLng(cKey)
                    dayNo = CLng(days(cKey))
                    Set cel = ws.Cells(r, c)

                    If dayNo > monthDays And LIMIT_TO_MONTH_END Then
                        ' その月に存在しない日（31日まで無い月）は対象外
                        If CLEAR_BEYOND_MONTH_END Then
                            If Not (SKIP_FORMULA_CELLS And cel.HasFormula) Then cel.ClearContents
                        End If
                    Else
                        cellKey = keyBase & CStr(dayNo) & "|" & dbCol
                        If cache.Exists(cellKey) Then
                            blockHits = blockHits + 1
                            If SKIP_FORMULA_CELLS And cel.HasFormula Then
                                skipFormula = skipFormula + 1
                            Else
                                cel.Value = cache(cellKey)
                                writeCount = writeCount + 1
                            End If
                        Else
                            missCount = missCount + 1
                            If WRITE_ZERO_WHEN_MISSING Then
                                If SKIP_FORMULA_CELLS And cel.HasFormula Then
                                    skipFormula = skipFormula + 1
                                Else
                                    cel.Value = 0
                                    writeCount = writeCount + 1
                                End If
                            End If
                        End If
                    End If
                Next cKey
            Next rKey

            If blockHits = 0 Then
                emptyBlocks.Add CStr(blk("title")) & "  （検索キー: " & _
                                lineVal & IIf(Len(shiftVal) > 0, " / " & shiftVal, "") & "）"
            End If
        End If
    Next blk
End Sub

Private Sub ClearBlocks(ByVal ws As Worksheet, ByVal blocks As Collection, ByVal maxDay As Long)
    Dim blk As Object, items As Object, days As Object
    Dim rKey As Variant, cKey As Variant
    Dim cel As Range

    For Each blk In blocks
        Set items = blk("items")
        Set days = blk("days")
        For Each rKey In items.Keys
            For Each cKey In days.Keys
                If CLng(days(cKey)) <= maxDay Then
                    Set cel = ws.Cells(CLng(rKey), CLng(cKey))
                    If Not (SKIP_FORMULA_CELLS And cel.HasFormula) Then cel.ClearContents
                End If
            Next cKey
        Next rKey
    Next blk
End Sub

' シートに無い品種の行を追加する。戻り値は追加した行数
'   追加位置 : その品種行群の直後 → 無ければ PRODUCT_ROW_ANCHOR の行の直後 → 無ければ最終項目行の直後
Private Function EnsureProductRows(ByVal ws As Worksheet, ByVal blocks As Collection, _
                                   ByVal splits As Object, ByVal shiftMap As Object, _
                                   ByVal lineMap As Object) As Long
    Dim bi As Long, blk As Object, items As Object, prodList As Object
    Dim rKey As Variant, pKey As Variant
    Dim spec As String, blockKey As String, lineVal As String, shiftVal As String
    Dim anchorKey As String, label As String
    Dim existing As Object, missing() As String, nMissing As Long
    Dim r As Long, lastProdRow As Long, anchorRow As Long, lastItemRow As Long, pos As Long
    Dim added As Long, i As Long

    anchorKey = NormText(PRODUCT_ROW_ANCHOR)

    ' 行を挿入すると下の行番号がずれるため、下のブロックから処理する
    For bi = blocks.Count To 1 Step -1
        Set blk = blocks(bi)
        Set items = blk("items")
        If items.Count > 0 Then

            lineVal = MapLine(lineMap, CStr(blk("line")))
            If Len(FLD_SHIFT) > 0 Then
                shiftVal = MapShift(shiftMap, CStr(blk("shift")))
            Else
                shiftVal = ""
            End If
            blockKey = NormText(lineVal) & "|" & NormText(shiftVal)

            If splits.Exists(blockKey) Then
                Set prodList = splits(blockKey)

                ' 既にある品種行と、挿入位置の候補を調べる
                Set existing = NewDict()
                lastProdRow = 0: anchorRow = 0: lastItemRow = 0
                For Each rKey In items.Keys
                    r = CLng(rKey)
                    spec = CStr(items(rKey))
                    If r > lastItemRow Then lastItemRow = r
                    If Left$(spec, Len(SPLIT_PREFIX)) = SPLIT_PREFIX Then
                        existing(Mid$(spec, Len(SPLIT_PREFIX) + 1)) = 1
                        If r > lastProdRow Then lastProdRow = r
                    End If
                    If NormText(CellText(ws.Cells(r, 1))) = anchorKey Then anchorRow = r
                Next rKey

                ' 不足している品種を集める
                nMissing = 0
                ReDim missing(1 To prodList.Count)
                For Each pKey In prodList.Keys
                    If Not existing.Exists(CStr(pKey)) Then
                        nMissing = nMissing + 1
                        missing(nMissing) = CStr(prodList(pKey))
                    End If
                Next pKey

                If nMissing > 0 Then
                    SortNames missing, nMissing

                    pos = lastProdRow
                    If pos = 0 Then pos = anchorRow
                    If pos = 0 Then pos = lastItemRow

                    For i = 1 To nMissing
                        label = missing(i) & PRODUCT_ROW_SUFFIX
                        ws.Rows(pos + 1).Insert Shift:=xlDown, CopyOrigin:=xlFormatFromLeftOrAbove
                        ws.Cells(pos + 1, 1).Value = label
                        pos = pos + 1
                        added = added + 1
                    Next i
                End If
            End If
        End If
    Next bi

    EnsureProductRows = added
End Function

' 文字列配列の簡易ソート（1〜n）
Private Sub SortNames(ByRef arr() As String, ByVal n As Long)
    Dim i As Long, j As Long, tmp As String
    For i = 1 To n - 1
        For j = i + 1 To n
            If StrComp(arr(i), arr(j), vbTextCompare) > 0 Then
                tmp = arr(i): arr(i) = arr(j): arr(j) = tmp
            End If
        Next j
    Next i
End Sub

' 見出し行の日付欄に 1〜月末 を書き込む（日付行も空の新規表向け）
Private Sub WriteDayHeaders(ByVal ws As Worksheet, ByVal blocks As Collection, ByVal monthDays As Long)
    Dim blk As Object, days As Object, cKey As Variant
    Dim cel As Range, dayNo As Long

    For Each blk In blocks
        Set days = blk("days")
        For Each cKey In days.Keys
            dayNo = CLng(days(cKey))
            Set cel = ws.Cells(CLng(blk("row")), CLng(cKey))
            If Not (SKIP_FORMULA_CELLS And cel.HasFormula) Then
                If dayNo <= monthDays Then
                    cel.Value = dayNo
                ElseIf LIMIT_TO_MONTH_END Then
                    cel.ClearContents
                End If
            End If
        Next cKey
    Next blk
End Sub

Private Function BuildReport(ByVal yy As Long, ByVal mm As Long, ByVal monthDays As Long, _
                             ByVal blocks As Collection, _
                             ByVal recCount As Long, ByVal writeCount As Long, _
                             ByVal skipFormula As Long, ByVal missCount As Long, _
                             ByVal addedRows As Long, _
                             ByVal unknownLabels As Collection, ByVal emptyBlocks As Collection) As String
    Dim s As String, i As Long, n As Long

    s = yy & "年" & mm & "月 (1〜" & monthDays & "日) の取り込みが完了しました。" & vbCrLf & vbCrLf
    s = s & "対象ブロック数 : " & blocks.Count & vbCrLf
    s = s & "取得レコード数 : " & recCount & vbCrLf
    s = s & "書き込みセル数 : " & writeCount & vbCrLf
    s = s & "該当データなし : " & missCount & " セル" & vbCrLf
    If skipFormula > 0 Then s = s & "数式のためスキップ : " & skipFormula & " セル" & vbCrLf
    If addedRows > 0 Then s = s & "追加した品種の行 : " & addedRows & " 行" & vbCrLf

    If unknownLabels.Count > 0 Then
        s = s & vbCrLf & "※ 対応表(BuildFieldMap)に無い項目名（取り込み対象外）:" & vbCrLf
        n = unknownLabels.Count
        If n > 15 Then n = 15
        For i = 1 To n
            s = s & "  ・" & unknownLabels(i) & vbCrLf
        Next i
        If unknownLabels.Count > n Then s = s & "  ・ほか " & (unknownLabels.Count - n) & " 件" & vbCrLf
    End If

    If emptyBlocks.Count > 0 Then
        s = s & vbCrLf & "※ 1件も該当データが無かったブロック:" & vbCrLf
        n = emptyBlocks.Count
        If n > 15 Then n = 15
        For i = 1 To n
            s = s & "  ・" & emptyBlocks(i) & vbCrLf
        Next i
        If emptyBlocks.Count > n Then s = s & "  ・ほか " & (emptyBlocks.Count - n) & " 件" & vbCrLf
        s = s & "  → 設備番号・直区分の変換（BuildLineMap / BuildShiftMap）をご確認ください。" & vbCrLf
    End If

    If recCount = 0 Then
        s = s & vbCrLf & "レコードが0件でした。対象年月・接続先をご確認ください。"
    End If

    BuildReport = s
End Function


'==================== 汎用ヘルパー ====================

' 取り込み先シートを取得
'   SHEET_NAME が空 : アクティブシート
'   指定あり        : マクロのあるブック → 見つからなければアクティブブック の順に探す
' 年月セルから対象期間（月初〜翌月初）を求める
Private Sub GetPeriod(ByRef dFrom As Date, ByRef dTo As Date)
    Dim ws As Worksheet, yy As Long, mm As Long

    Set ws = GetTargetSheet()
    yy = ReadYear(ws.Range(YEAR_CELL))
    mm = ReadMonth(ws.Range(MONTH_CELL))

    If yy < 1900 Or yy > 2999 Then
        Err.Raise vbObjectError + 1, , "年セル(" & YEAR_CELL & ")から年を読み取れませんでした。"
    End If
    If mm < 1 Or mm > 12 Then
        Err.Raise vbObjectError + 2, , "月セル(" & MONTH_CELL & ")から月を読み取れませんでした。"
    End If

    dFrom = DateSerial(yy, mm, 1)
    dTo = DateSerial(yy, mm + 1, 1)
End Sub

Private Function GetTargetSheet() As Worksheet
    Dim ws As Worksheet

    If Len(SHEET_NAME) = 0 Then
        If ActiveSheet Is Nothing Then
            Err.Raise vbObjectError + 10, , "対象シートが取得できません。"
        End If
        Set GetTargetSheet = ActiveSheet
        Exit Function
    End If

    Set ws = FindSheet(ThisWorkbook, SHEET_NAME)
    If ws Is Nothing Then
        If Not ActiveWorkbook Is Nothing Then
            If Not ActiveWorkbook Is ThisWorkbook Then
                Set ws = FindSheet(ActiveWorkbook, SHEET_NAME)
            End If
        End If
    End If

    If ws Is Nothing Then
        Err.Raise vbObjectError + 11, , "シート「" & SHEET_NAME & "」が見つかりません。" & vbCrLf & _
                                        "シート名を確認するか、SHEET_NAME を書き換えてください。"
    End If

    Set GetTargetSheet = ws
End Function

' ブック内からシート名で探す（大文字小文字・全角半角・空白の違いは無視）
Private Function FindSheet(ByVal wb As Workbook, ByVal sheetName As String) As Worksheet
    Dim sh As Worksheet, target As String

    If wb Is Nothing Then Exit Function
    target = NormText(sheetName)

    For Each sh In wb.Worksheets
        If StrComp(NormText(sh.Name), target, vbTextCompare) = 0 Then
            Set FindSheet = sh
            Exit Function
        End If
    Next sh
End Function

Private Function NewDict() As Object
    Set NewDict = CreateObject("Scripting.Dictionary")
End Function

' 短い書き方（集計は AGGREGATE_MODE、絞り込み無し）
Private Sub AddMap(ByVal m As Object, ByVal sheetLabel As String, ByVal dbName As String)
    AddCol m, sheetLabel, dbName, AGGREGATE_MODE, "", ""
End Sub

' 集計方法・絞り込み付きで登録する
Private Sub AddCol(ByVal m As Object, ByVal sheetLabel As String, ByVal dbName As String, _
                   ByVal aggregate As String, ByVal filterCol As String, ByVal filterValues As String)
    m(NormText(sheetLabel)) = dbName & vbTab & UCase$(Trim$(aggregate)) & vbTab & _
                              filterCol & vbTab & filterValues
End Sub

' 仕様文字列の取り出し  0=列名 1=集計 2=絞り込み列 3=絞り込み値
Private Function SpecPart(ByVal spec As String, ByVal index As Long) As String
    Dim parts() As String
    parts = Split(spec, vbTab)
    If index <= UBound(parts) Then SpecPart = parts(index)
End Function

' 絞り込み条件に合う行か
Private Function SpecMatches(ByVal spec As String, ByVal rs As Object) As Boolean
    Dim col As String, vals As String, v As String
    Dim list() As String, i As Long, pat As String

    col = SpecPart(spec, 2)
    vals = SpecPart(spec, 3)
    If Len(col) = 0 Or Len(vals) = 0 Then
        SpecMatches = True
        Exit Function
    End If

    v = NormText(NzStr(rs.Fields(col).Value))
    list = Split(vals, ",")
    For i = LBound(list) To UBound(list)
        pat = NormText(list(i))
        If Len(pat) > 0 Then
            If Left$(pat, 1) = "*" And Right$(pat, 1) = "*" And Len(pat) > 2 Then
                If InStr(1, v, Mid$(pat, 2, Len(pat) - 2), vbTextCompare) > 0 Then SpecMatches = True: Exit Function
            ElseIf Right$(pat, 1) = "*" Then
                If StrComp(Left$(v, Len(pat) - 1), Left$(pat, Len(pat) - 1), vbTextCompare) = 0 Then SpecMatches = True: Exit Function
            ElseIf Left$(pat, 1) = "*" Then
                If StrComp(Right$(v, Len(pat) - 1), Mid$(pat, 2), vbTextCompare) = 0 Then SpecMatches = True: Exit Function
            Else
                If StrComp(v, pat, vbTextCompare) = 0 Then SpecMatches = True: Exit Function
            End If
        End If
    Next i
End Function

' 設備番号の変換（登録があればそれ、無ければ接頭辞を付ける）
Private Function MapLine(ByVal m As Object, ByVal key As String) As String
    Dim k As String
    k = NormText(key)
    If m.Exists(k) Then
        MapLine = CStr(m(k))
    ElseIf Len(LINE_CODE_PREFIX) > 0 Then
        MapLine = LINE_CODE_PREFIX & key
    Else
        MapLine = key
    End If
End Function

' 区分の変換（完全一致 → 部分一致 → そのまま）
Private Function MapShift(ByVal m As Object, ByVal key As String) As String
    Dim k As String, mk As Variant
    Dim best As String, bestLen As Long

    k = NormText(key)

    If m.Exists(k) Then
        MapShift = CStr(m(k))
        Exit Function
    End If

    If SHIFT_PARTIAL_MATCH And Len(k) > 0 Then
        ' 一致した中で最も長いキーを採用（「テレスコ昼」と「昼」の取り違えを防ぐ）
        For Each mk In m.Keys
            If Len(CStr(mk)) > 0 Then
                If InStr(k, CStr(mk)) > 0 And Len(CStr(mk)) > bestLen Then
                    best = CStr(m(mk))
                    bestLen = Len(CStr(mk))
                End If
            End If
        Next mk
        If bestLen > 0 Then
            MapShift = best
            Exit Function
        End If
    End If

    MapShift = key
End Function

Private Function MapValue(ByVal m As Object, ByVal key As String) As String
    Dim k As String
    k = NormText(key)
    If m.Exists(k) Then
        MapValue = CStr(m(k))
    Else
        MapValue = key
    End If
End Function

' 表記ゆれ吸収：空白除去 ＋ 全角→半角（英数・カナ）
Private Function NormText(ByVal s As String) As String
    Dim t As String
    t = s
    t = Replace(t, " ", "")
    t = Replace(t, ChrW(&H3000), "")   ' 全角スペース
    t = Replace(t, vbTab, "")
    t = Replace(t, vbCr, "")
    t = Replace(t, vbLf, "")
    On Error Resume Next
    t = StrConv(t, vbNarrow)
    On Error GoTo 0
    NormText = t
End Function

' セルの表示値を文字列で取得（エラー値も安全に扱う）
Private Function CellText(ByVal cel As Range) As String
    Dim v As Variant
    v = cel.Value
    If IsError(v) Or IsEmpty(v) Then
        CellText = ""
    Else
        CellText = CStr(v)
    End If
End Function

' 開始・終了から稼働時間を計算する（求められなければ Null）
Private Function CalcDuration(ByVal rs As Object) As Variant
    Dim st As Double, en As Double, mins As Double, brk As Double
    Dim v As Variant

    CalcDuration = Null

    st = ParseTimeMinutes(rs.Fields(FLD_START).Value)
    en = ParseTimeMinutes(rs.Fields(FLD_END).Value)
    If st < 0 Or en < 0 Then Exit Function

    mins = en - st
    If mins < 0 Then mins = mins + 24 * 60      ' 夜勤など日をまたぐ場合

    ' 休憩の差し引き
    If Len(FLD_BREAK) > 0 Then
        v = rs.Fields(FLD_BREAK).Value
        If Not IsNull(v) Then
            If IsNumeric(v) Then
                brk = CDbl(v)
            Else
                brk = ParseTimeMinutes(v)
                If brk < 0 Then brk = 0
            End If
        End If
    Else
        brk = BREAK_MINUTES
    End If

    mins = mins - brk
    If mins < 0 Then mins = 0

    If UCase$(Trim$(DURATION_UNIT)) = "HOUR" Then
        CalcDuration = Round(mins / 60, DURATION_DECIMALS)
    Else
        CalcDuration = Round(mins, DURATION_DECIMALS)
    End If
End Function

' 時刻の値を「0時からの分」に変換する（判定できなければ -1）
'   対応: 時刻型 / "08:00" / "0800" / 800 / "08:00:00" / "20260701080000"
Private Function ParseTimeMinutes(ByVal v As Variant) As Double
    Dim t As String, digits As String, i As Long, ch As String
    Dim d As Date, h As Long, mi As Long

    ParseTimeMinutes = -1
    If IsNull(v) Or IsEmpty(v) Then Exit Function
    If IsError(v) Then Exit Function

    If IsDate(v) Then
        d = CDate(v)
        ParseTimeMinutes = Hour(d) * 60 + Minute(d) + Second(d) / 60
        Exit Function
    End If

    t = NormText(CStr(v))

    ' "2022-06-01T08:30:00.000+0900" のように ':' を含む場合は最初の ':' の前後を時分とみなす
    i = InStr(t, ":")
    If i >= 3 Then
        If IsNumeric(Mid$(t, i - 2, 2)) And IsNumeric(Mid$(t, i + 1, 2)) Then
            h = CLng(Mid$(t, i - 2, 2))
            mi = CLng(Mid$(t, i + 1, 2))
            If h <= 24 And mi <= 59 Then ParseTimeMinutes = h * 60 + mi
            Exit Function
        End If
    End If

    For i = 1 To Len(t)
        ch = Mid$(t, i, 1)
        If ch >= "0" And ch <= "9" Then digits = digits & ch
    Next i
    If Len(digits) = 0 Then Exit Function

    Select Case Len(digits)
        Case 1, 2                                   ' "8" / "08"
            h = CLng(digits): mi = 0
        Case 3                                      ' "800"
            h = CLng(Left$(digits, 1)): mi = CLng(Mid$(digits, 2, 2))
        Case 4                                      ' "0800"
            h = CLng(Left$(digits, 2)): mi = CLng(Mid$(digits, 3, 2))
        Case 5                                      ' "80000"
            h = CLng(Left$(digits, 1)): mi = CLng(Mid$(digits, 2, 2))
        Case 6                                      ' "080000"
            h = CLng(Left$(digits, 2)): mi = CLng(Mid$(digits, 3, 2))
        Case 12, 14                                 ' "yyyymmddhhmm(ss)"
            h = CLng(Mid$(digits, 9, 2)): mi = CLng(Mid$(digits, 11, 2))
        Case Else
            Exit Function
    End Select

    If h > 24 Or mi > 59 Then Exit Function
    ParseTimeMinutes = h * 60 + mi
End Function

' 日付列の値から「日」を取り出す
'   日付型 / "2026-07-01" / "2026/07/01" / "20260701"（文字列・数値）に対応
Private Function ParseDayNumber(ByVal v As Variant) As Long
    Dim t As String, i As Long, ch As String, digits As String, n As Long

    If IsNull(v) Or IsEmpty(v) Then Exit Function
    If IsError(v) Then Exit Function

    If IsDate(v) Then
        ParseDayNumber = Day(CDate(v))
        Exit Function
    End If

    t = NormText(CStr(v))
    For i = 1 To Len(t)
        ch = Mid$(t, i, 1)
        If ch >= "0" And ch <= "9" Then digits = digits & ch
    Next i

    If Len(digits) >= 8 Then
        n = CLng(Mid$(digits, 7, 2))       ' YYYYMMDD の DD
        If n >= 1 And n <= 31 Then ParseDayNumber = n
    End If
End Function

Private Function NzStr(ByVal v As Variant) As String
    If IsNull(v) Or IsEmpty(v) Then
        NzStr = ""
    Else
        NzStr = CStr(v)
    End If
End Function

Private Sub AddUnique(ByVal c As Collection, ByVal s As String)
    Dim i As Long
    For i = 1 To c.Count
        If c(i) = s Then Exit Sub
    Next i
    c.Add s
End Sub

' 年セルの読み取り（2026 / 2026年 / 日付 いずれでも可）
Private Function ReadYear(ByVal cel As Range) As Long
    Dim v As Variant, n As Long
    v = cel.Value
    If IsEmpty(v) Or IsError(v) Then Exit Function
    If IsDate(v) Then
        ReadYear = Year(CDate(v))
    ElseIf IsNumeric(v) Then
        n = CLng(v)
        If n >= 1900 And n <= 2999 Then ReadYear = n
    Else
        ReadYear = ExtractNumber(CStr(v))
    End If
End Function

' 月セルの読み取り（7 / 7月 / 日付 いずれでも可）
Private Function ReadMonth(ByVal cel As Range) As Long
    Dim v As Variant
    v = cel.Value
    If IsEmpty(v) Or IsError(v) Then Exit Function
    If IsDate(v) Then
        ReadMonth = Month(CDate(v))
    ElseIf IsNumeric(v) Then
        ReadMonth = CLng(v)
    Else
        ReadMonth = ExtractNumber(CStr(v))
    End If
End Function

' 文字列から最初の数字並びを取り出す
Private Function ExtractNumber(ByVal s As String) As Long
    Dim t As String, i As Long, ch As String, buf As String
    t = NormText(s)
    For i = 1 To Len(t)
        ch = Mid$(t, i, 1)
        If ch >= "0" And ch <= "9" Then
            buf = buf & ch
        ElseIf Len(buf) > 0 Then
            Exit For
        End If
    Next i
    If Len(buf) > 0 Then ExtractNumber = CLng(buf)
End Function
