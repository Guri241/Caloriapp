Attribute VB_Name = "modApiImport"
Option Explicit

'==================================================================
' modApiImport : API(JSON) → 生産実績シート 取り込み
'   実行 : TestApi → ImportFromApi
'   設定 : 下の ①～⑥ だけ。詳細は README.md
'==================================================================


'================== ① API 接続 ==================

' <FROM> <TO> に対象期間の日付が入ります
Private Const API_URL     As String = "https://example.co.jp/api/records?from=<FROM>&to=<TO>"
Private Const API_METHOD  As String = "GET"

' 通信に使う部品
'   "MSXML2.XMLHTTP"          : ブラウザ(IE/Edge)と同じプロキシ設定を使う ← 社内APIはこちら
'   "MSXML2.ServerXMLHTTP.6.0": WinHTTPの設定を使う（プロキシ設定が別）
Private Const HTTP_OBJECT As String = "MSXML2.XMLHTTP"
Private Const API_BODY    As String = ""        ' POST のときの本文

' --- 認証 : 使う方式のところだけ埋めてください ---
' ① ID・パスワード方式（Basic認証など）
Private Const API_USER As String = ""
Private Const API_PASS As String = ""
' ② トークン／APIキー方式（複数ヘッダーは | 区切り）
'      "Authorization: Bearer xxxxx"
'      "X-API-KEY: xxxxx|Accept: application/json"
Private Const API_HEADERS As String = ""
' ③ URLにキーを付ける方式は API_URL に直接書いてください
'      "https://…/api/records?key=xxxxx&from=<FROM>&to=<TO>"
Private Const API_DATE_FORMAT As String = "yyyy-mm-dd"

' レコードの配列が入っている場所（最上位が配列なら空のまま）
'   例) {"data":{"items":[ ... ]}} なら "data.items"
Private Const API_RECORDS_PATH As String = ""

' 1日ずつ呼び出す（月まとめて取れるなら False）
Private Const FETCH_BY_DAY As Boolean = True


'================== ② レコードのキー名 ==================

Private Const API_FLD_DATE  As String = "date"
Private Const API_FLD_LINE  As String = "line_cd"
Private Const API_FLD_SHIFT As String = "shift"        ' 無ければ ""

' 稼働時間を 終了-開始 で計算する場合のみ使用（CALC_DURATION 指定時）
Private Const API_FLD_START     As String = "start_time"
Private Const API_FLD_END       As String = "end_time"
Private Const API_FLD_BREAK     As String = ""         ' 休憩(分)のキー
Private Const BREAK_MINUTES     As Long = 0            ' 一律で引く分数
Private Const DURATION_UNIT     As String = "MINUTE"   ' "MINUTE" / "HOUR"
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

Private Const LINE_LIST           As String = _
    "8020,8021,8022,8023,8024,8025,8026,8788,750B,347D,825B,反力"
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
Private Const SPLIT_COLUMN          As String = "seban"        ' 品種のキー名
Private Const SPLIT_VALUE_COLUMN    As String = "product_count" ' 生産数のキー名
Private Const PRODUCT_ROW_SUFFIX    As String = "生産数"
Private Const PRODUCT_ROW_ANCHOR    As String = "良品数(個)"
Private Const AUTO_ADD_PRODUCT_ROWS As Boolean = True
Private Const SPLIT_PREFIX          As String = "<品種>"

' 試験用 : 取り込む日数を制限する（0 = 制限なし）
Private Const MAX_IMPORT_DAYS As Long = 0


'================== ④ 項目名 → APIのキー名 ==================
'   AddCol m, シートの項目名, キー名, 集計, 絞り込みキー, 絞り込み値
'     集計 : SUM / MAX / MIN / COUNT / LAST / FIRST
'     絞り込み値 : カンマ区切り。末尾 * で前方一致、前後 * で部分一致
Private Sub BuildFieldMap(ByVal m As Object)
    AddCol m, "稼働時間", "working_minutes", "MAX", "", ""
    AddCol m, "良品数(個)", "product_count", "SUM", "", ""
    AddCol m, "基準人数(最小人数)", "person_count", "MAX", "", ""
End Sub


'================== ⑤ 値の読み替え ==================
' シートの表記 → APIに入っている値
Private Sub BuildShiftMap(ByVal m As Object)
    AddMap m, "昼", "1"
    AddMap m, "夜", "2"
    ' AddMap m, "スライダ", "1"
End Sub

Private Sub BuildLineMap(ByVal m As Object)
    ' AddMap m, "8020", "AS8046"      ' LINE_CODE_PREFIX で足りない場合だけ
End Sub


'================== ⑥ 品種の表示名 ==================
' APIの品種コード → 行名に使う表示名（未登録はコードをそのまま行名にする）
Private Sub BuildProductMap(ByVal m As Object)
    ' AddMap m, "TMC300D", "TT"
End Sub


'==================================================================
'  ここから下は通常編集不要
'==================================================================

'------------------------------------------------------------------
' メイン : APIから取り込む
'------------------------------------------------------------------
Public Sub ImportFromApi()
    Dim ws As Worksheet
    Dim fieldMap As Object, shiftMap As Object, lineMap As Object, productMap As Object
    Dim blocks As Collection, unknownLabels As Collection, emptyBlocks As Collection
    Dim splits As Object, cache As Object
    Dim yy As Long, mm As Long, monthDays As Long, addedRows As Long
    Dim dFrom As Date, dTo As Date
    Dim recCount As Long, writeCount As Long, skipFormula As Long, missCount As Long
    Dim calcMode As XlCalculation
    Dim restored As Boolean
    Dim errNum As Long, errDesc As String

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
    monthDays = Day(dTo - 1)

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
        Err.Raise vbObjectError + 4, , "A列にブロック見出し（例: 8020 昼）が見つかりませんでした。"
    End If

    Application.ScreenUpdating = False
    calcMode = Application.Calculation
    Application.Calculation = xlCalculationManual

    Set cache = FetchApi(dFrom, dTo, fieldMap, productMap, splits, recCount)

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
    Application.StatusBar = False
    restored = True

    MsgBox BuildReport(yy, mm, monthDays, blocks, recCount, writeCount, skipFormula, missCount, _
                       addedRows, unknownLabels, emptyBlocks), _
           vbInformation, "API取り込み完了"
    Exit Sub

ErrHandler:
    errNum = Err.Number: errDesc = Err.Description
    If Not restored Then
        On Error Resume Next
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        Application.StatusBar = False
        On Error GoTo 0
    End If
    MsgBox "取り込みに失敗しました。" & vbCrLf & vbCrLf & _
           "エラー " & errNum & " : " & errDesc, vbCritical, "API取り込み"
End Sub

'------------------------------------------------------------------
' API接続テスト : 1日分を呼び出し、件数と先頭1件の中身を表示する
'------------------------------------------------------------------
Public Sub TestApi()
    Dim recs As Collection, rec As Object, k As Variant
    Dim dFrom As Date, dumm As Date, dTo As Date
    Dim url As String, msg As String, i As Long
    Dim errNum As Long, errDesc As String

    On Error GoTo ErrHandler

    GetPeriod dFrom, dumm
    dTo = DateAdd("d", 1, dFrom)
    url = ApiUrl(dFrom, dTo)

    Set recs = ApiRecords(url)

    msg = "URL:" & vbCrLf & url & vbCrLf & vbCrLf
    msg = msg & "取得件数 : " & recs.Count & " 件" & vbCrLf & vbCrLf

    If recs.Count > 0 Then
        Set rec = recs(1)
        msg = msg & "【先頭1件】" & vbCrLf
        For Each k In rec.Keys
            i = i + 1
            If i <= 30 Then
                msg = msg & "  " & CStr(k) & " = "
                If IsObject(rec(k)) Then
                    msg = msg & "(入れ子)"
                Else
                    msg = msg & NzStr(rec(k))
                End If
                msg = msg & vbCrLf
            End If
        Next k
        msg = msg & vbCrLf & "→ 日 = " & ParseDayNumber(DictVal(rec, API_FLD_DATE)) & _
              " / 設備 = " & NzStr(DictVal(rec, API_FLD_LINE)) & _
              " / 直 = " & NzStr(DictVal(rec, API_FLD_SHIFT))
    Else
        msg = msg & "レコードが取れていません。API_RECORDS_PATH をご確認ください。"
    End If

    MsgBox msg, vbInformation, "API接続テスト"
    Exit Sub

ErrHandler:
    errNum = Err.Number: errDesc = Err.Description
    MsgBox "エラー " & errNum & " : " & errDesc & vbCrLf & vbCrLf & "URL:" & vbCrLf & url, _
           vbCritical, "API接続テスト"
End Sub


'==================== API取得 ====================

' 期間分のレコードを取得して 設備|直|日|項目 → 値 のディクショナリに詰める
Private Function FetchApi(ByVal dFrom As Date, ByVal dTo As Date, ByVal fieldMap As Object, _
                          ByVal productMap As Object, ByVal splits As Object, _
                          ByRef recCount As Long) As Object
    Dim cache As Object, specs As Object
    Dim recs As Collection, rec As Object
    Dim k As Variant, spec As String, col As String, filterCol As String
    Dim chunkFrom As Date, chunkTo As Date, dayCount As Long
    Dim dayNo As Long, lineKey As String, shiftKey As String, keyBase As String
    Dim val As Variant
    Dim prodRaw As String, prodName As String, prodKey As String, blockKey As String
    Dim prodList As Object

    Set cache = NewDict()
    Set specs = UniqueSpecs(fieldMap)
    recCount = 0

    Application.EnableCancelKey = xlErrorHandler

    chunkFrom = dFrom
    Do While chunkFrom < dTo
        If FETCH_BY_DAY Then
            chunkTo = DateAdd("d", 1, chunkFrom)
        Else
            chunkTo = dTo
        End If
        If chunkTo > dTo Then chunkTo = dTo

        dayCount = dayCount + 1
        Application.StatusBar = "APIから取得中… " & Format$(chunkFrom, "m/d") & _
                                "（" & Format$(recCount, "#,##0") & "件）"
        DoEvents

        Set recs = ApiRecords(ApiUrl(chunkFrom, chunkTo))

        For Each rec In recs
            dayNo = ParseDayNumber(DictVal(rec, API_FLD_DATE))
            If dayNo > 0 Then
                lineKey = NormText(NzStr(DictVal(rec, API_FLD_LINE)))
                If Len(API_FLD_SHIFT) > 0 Then
                    shiftKey = NormText(NzStr(DictVal(rec, API_FLD_SHIFT)))
                Else
                    shiftKey = ""
                End If
                keyBase = lineKey & "|" & shiftKey & "|" & CStr(dayNo) & "|"

                For Each k In specs.Keys
                    spec = CStr(k)
                    col = SpecPart(spec, 0)
                    filterCol = SpecPart(spec, 2)

                    If Len(filterCol) > 0 Then
                        If Not SpecMatchesValue(spec, NzStr(DictVal(rec, filterCol))) Then col = ""
                    End If

                    If Len(col) > 0 Then
                        If IsCalcColumn(col) Then
                            val = CalcDurationFrom(DictVal(rec, API_FLD_START), _
                                                   DictVal(rec, API_FLD_END), _
                                                   DictVal(rec, API_FLD_BREAK))
                        Else
                            val = DictVal(rec, col)
                        End If
                        If Not IsNull(val) And Not IsEmpty(val) Then
                            Accumulate cache, keyBase & spec, val, SpecPart(spec, 1)
                        End If
                    End If
                Next k

                If SPLIT_ENABLED Then
                    prodRaw = NzStr(DictVal(rec, SPLIT_COLUMN))
                    If Len(Trim$(prodRaw)) > 0 Then
                        prodName = MapValue(productMap, prodRaw)
                        prodKey = NormText(prodName)
                        val = DictVal(rec, SPLIT_VALUE_COLUMN)
                        If Not IsNull(val) And Not IsEmpty(val) Then
                            Accumulate cache, keyBase & SPLIT_PREFIX & prodKey, val, "SUM"
                        End If

                        blockKey = lineKey & "|" & shiftKey
                        If Not splits.Exists(blockKey) Then Set splits(blockKey) = NewDict()
                        Set prodList = splits(blockKey)
                        If Not prodList.Exists(prodKey) Then prodList(prodKey) = prodName
                    End If
                End If

                recCount = recCount + 1
            End If
        Next rec

        chunkFrom = chunkTo
        If MAX_IMPORT_DAYS > 0 And dayCount >= MAX_IMPORT_DAYS Then Exit Do
    Loop

    Application.StatusBar = False
    Set FetchApi = cache
End Function


'==================== 共通処理 ====================

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

' 日付(1～31)とシート列の対応表を作る
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

' 指定行に入っている 1～31 の数字（または日付）を読んで 列→日 を作る
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
            If Len(API_FLD_SHIFT) > 0 Then
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
            If Len(API_FLD_SHIFT) > 0 Then
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

' 文字列配列の簡易ソート（1～n）
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

' 見出し行の日付欄に 1～月末 を書き込む（日付行も空の新規表向け）
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

    s = yy & "年" & mm & "月 (1～" & monthDays & "日) の取り込みが完了しました。" & vbCrLf & vbCrLf
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

' 取り込み先シートを取得
'   SHEET_NAME が空 : アクティブシート
'   指定あり        : マクロのあるブック → 見つからなければアクティブブック の順に探す
' 年月セルから対象期間（月初～翌月初）を求める
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

' 単純な対応表（⑤⑥の値の読み替え用。④で使うと集計LAST・絞り込み無しになる）
Private Sub AddMap(ByVal m As Object, ByVal sheetLabel As String, ByVal dbName As String)
    m(NormText(sheetLabel)) = dbName
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

' 絞り込み条件に合う値か
Private Function SpecMatchesValue(ByVal spec As String, ByVal rawValue As String) As Boolean
    Dim vals As String, v As String
    Dim list() As String, i As Long, pat As String

    vals = SpecPart(spec, 3)
    If Len(SpecPart(spec, 2)) = 0 Or Len(vals) = 0 Then
        SpecMatchesValue = True
        Exit Function
    End If

    v = NormText(rawValue)
    list = Split(vals, ",")
    For i = LBound(list) To UBound(list)
        pat = NormText(list(i))
        If Len(pat) > 0 Then
            If Left$(pat, 1) = "*" And Right$(pat, 1) = "*" And Len(pat) > 2 Then
                If InStr(1, v, Mid$(pat, 2, Len(pat) - 2), vbTextCompare) > 0 Then SpecMatchesValue = True: Exit Function
            ElseIf Right$(pat, 1) = "*" Then
                If StrComp(Left$(v, Len(pat) - 1), Left$(pat, Len(pat) - 1), vbTextCompare) = 0 Then SpecMatchesValue = True: Exit Function
            ElseIf Left$(pat, 1) = "*" Then
                If StrComp(Right$(v, Len(pat) - 1), Mid$(pat, 2), vbTextCompare) = 0 Then SpecMatchesValue = True: Exit Function
            Else
                If StrComp(v, pat, vbTextCompare) = 0 Then SpecMatchesValue = True: Exit Function
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

' 開始・終了・休憩の値から稼働時間を計算する
Private Function CalcDurationFrom(ByVal startVal As Variant, ByVal endVal As Variant, _
                                  ByVal breakVal As Variant) As Variant
    Dim st As Double, en As Double, mins As Double, brk As Double
    Dim v As Variant

    CalcDurationFrom = Null

    st = ParseTimeMinutes(startVal)
    en = ParseTimeMinutes(endVal)
    If st < 0 Or en < 0 Then Exit Function

    mins = en - st
    If mins < 0 Then mins = mins + 24 * 60      ' 夜勤など日をまたぐ場合

    ' 休憩の差し引き
    If Len(API_FLD_BREAK) > 0 Then
        v = breakVal
        If Not IsNull(v) And Not IsEmpty(v) Then
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
        CalcDurationFrom = Round(mins / 60, DURATION_DECIMALS)
    Else
        CalcDurationFrom = Round(mins, DURATION_DECIMALS)
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

' 項目ごとの仕様（重複除去）
Private Function UniqueSpecs(ByVal fieldMap As Object) As Object
    Dim specs As Object, k As Variant
    Set specs = NewDict()
    For Each k In fieldMap.Keys
        specs(CStr(fieldMap(k))) = 1
    Next k
    Set UniqueSpecs = specs
End Function

' 計算で求める疑似列か
Private Function IsCalcColumn(ByVal colName As String) As Boolean
    IsCalcColumn = (colName = CALC_DURATION)
End Function

' 絞り込み値をあらかじめ正規化しておく
Private Function NormPatterns(ByVal vals As String) As Variant
    Dim list() As String, i As Long
    If Len(vals) = 0 Then
        NormPatterns = Split("", ",")
        Exit Function
    End If
    list = Split(vals, ",")
    For i = LBound(list) To UBound(list)
        list(i) = NormText(list(i))
    Next i
    NormPatterns = list
End Function

' 正規化済みパターンとの一致判定（末尾 * = 前方一致 / 前後 * = 部分一致）
Private Function MatchPatterns(ByVal rawValue As String, ByVal pats As Variant) As Boolean
    Dim v As String, i As Long, pat As String

    If Not IsArray(pats) Then Exit Function
    If UBound(pats) < LBound(pats) Then
        MatchPatterns = True                ' 条件なし
        Exit Function
    End If

    v = NormText(rawValue)
    For i = LBound(pats) To UBound(pats)
        pat = CStr(pats(i))
        If Len(pat) > 0 Then
            If Left$(pat, 1) = "*" And Right$(pat, 1) = "*" And Len(pat) > 2 Then
                If InStr(1, v, Mid$(pat, 2, Len(pat) - 2), vbTextCompare) > 0 Then MatchPatterns = True: Exit Function
            ElseIf Right$(pat, 1) = "*" Then
                If StrComp(Left$(v, Len(pat) - 1), Left$(pat, Len(pat) - 1), vbTextCompare) = 0 Then MatchPatterns = True: Exit Function
            ElseIf Left$(pat, 1) = "*" Then
                If StrComp(Right$(v, Len(pat) - 1), Mid$(pat, 2), vbTextCompare) = 0 Then MatchPatterns = True: Exit Function
            Else
                If StrComp(v, pat, vbTextCompare) = 0 Then MatchPatterns = True: Exit Function
            End If
        End If
    Next i
End Function

' 日付を埋め込んだURLを作る
Private Function ApiUrl(ByVal dFrom As Date, ByVal dTo As Date) As String
    Dim u As String
    u = Replace(API_URL, "<FROM>", Format$(dFrom, API_DATE_FORMAT))
    u = Replace(u, "<TO>", Format$(dTo, API_DATE_FORMAT))
    ApiUrl = u
End Function

' APIを呼び、レコードの配列を取り出す
Private Function ApiRecords(ByVal url As String) As Collection
    Dim root As Variant, node As Variant, c As Collection, i As Long

    Set c = New Collection
    root = JsonParse(HttpText(url))

    If IsObject(root) Then
        node = JsonPath(root, API_RECORDS_PATH)
    Else
        Set ApiRecords = c
        Exit Function
    End If

    If Not IsObject(node) Then
        Set ApiRecords = c
        Exit Function
    End If

    If TypeName(node) = "Collection" Then
        For i = 1 To node.Count
            If IsObject(node(i)) Then c.Add node(i)
        Next i
    Else
        c.Add node                       ' レコードが1件だけの形
    End If

    Set ApiRecords = c
End Function

' APIを呼んで本文を返す（UTF-8として読み取り）
Private Function HttpText(ByVal url As String) As String
    Dim http As Object, hs() As String, i As Long, p As Long

    Set http = CreateObject(HTTP_OBJECT)
    If Len(API_USER) > 0 Then
        http.Open API_METHOD, url, False, API_USER, API_PASS
    Else
        http.Open API_METHOD, url, False
    End If

    If Len(API_HEADERS) > 0 Then
        hs = Split(API_HEADERS, "|")
        For i = LBound(hs) To UBound(hs)
            p = InStr(hs(i), ":")
            If p > 1 Then http.setRequestHeader Trim$(Left$(hs(i), p - 1)), Trim$(Mid$(hs(i), p + 1))
        Next i
    End If

    If Len(API_BODY) > 0 Then
        http.send API_BODY
    Else
        http.send
    End If

    If http.Status < 200 Or http.Status >= 300 Then
        Err.Raise vbObjectError + 60, , "APIがエラーを返しました。" & vbCrLf & _
                  "HTTP " & http.Status & " " & http.statusText & vbCrLf & vbCrLf & _
                  "応答ヘッダー:" & vbCrLf & Left$(HeadersOf(http), 400) & vbCrLf & vbCrLf & _
                  "応答本文:" & vbCrLf & Left$(Utf8Text(http), 400)
    End If

    HttpText = Utf8Text(http)
End Function

' 応答ヘッダーを取り出す（取れない場合は空）
Private Function HeadersOf(ByVal http As Object) As String
    On Error Resume Next
    HeadersOf = http.getAllResponseHeaders
    On Error GoTo 0
End Function

' 応答本文をUTF-8として文字列化する
Private Function Utf8Text(ByVal http As Object) As String
    Dim st As Object
    On Error GoTo Fallback
    Set st = CreateObject("ADODB.Stream")
    st.Type = 1
    st.Open
    st.Write http.responseBody
    st.Position = 0
    st.Type = 2
    st.Charset = "utf-8"
    Utf8Text = st.ReadText
    st.Close
    Exit Function
Fallback:
    Utf8Text = http.responseText
End Function

' レコードからキーで値を取り出す（大文字小文字の違いは吸収）
Private Function DictVal(ByVal rec As Object, ByVal keyName As String) As Variant
    Dim k As Variant
    If Len(keyName) = 0 Then Exit Function
    If rec.Exists(keyName) Then
        If IsObject(rec(keyName)) Then Exit Function       ' 入れ子はそのままでは扱わない
        DictVal = rec(keyName)
        Exit Function
    End If
    For Each k In rec.Keys
        If StrComp(CStr(k), keyName, vbTextCompare) = 0 Then
            If Not IsObject(rec(k)) Then DictVal = rec(k)
            Exit Function
        End If
    Next k
End Function

Private Function JsonParse(ByVal text As String) As Variant
    Dim p As Long, out As Variant
    p = 1
    JsonValueInto text, p, out
    If IsObject(out) Then Set JsonParse = out Else JsonParse = out
End Function

' "data.items" のような場所をたどる（空なら root をそのまま）
Private Function JsonPath(ByVal root As Variant, ByVal path As String) As Variant
    Dim parts() As String, i As Long, node As Variant

    If IsObject(root) Then Set node = root Else node = root
    If Len(Trim$(path)) = 0 Then
        If IsObject(node) Then Set JsonPath = node Else JsonPath = node
        Exit Function
    End If

    parts = Split(path, ".")
    For i = LBound(parts) To UBound(parts)
        If Not IsObject(node) Then Exit Function
        If TypeName(node) <> "Dictionary" Then Exit Function
        If Not node.Exists(parts(i)) Then Exit Function
        If IsObject(node(parts(i))) Then
            Set node = node(parts(i))
        Else
            node = node(parts(i))
        End If
    Next i

    If IsObject(node) Then Set JsonPath = node Else JsonPath = node
End Function

Private Sub JsonValueInto(ByRef s As String, ByRef p As Long, ByRef out As Variant)
    Dim ch As String
    JsonSkipWs s, p
    ch = Mid$(s, p, 1)
    Select Case ch
        Case "{": Set out = JsonObject(s, p)
        Case "[": Set out = JsonArray(s, p)
        Case """": out = JsonString(s, p)
        Case Else: out = JsonLiteral(s, p)
    End Select
End Sub

Private Function JsonObject(ByRef s As String, ByRef p As Long) As Object
    Dim d As Object, keyName As String, v As Variant

    Set d = NewDict()
    p = p + 1                                   ' {
    JsonSkipWs s, p
    If Mid$(s, p, 1) = "}" Then
        p = p + 1
        Set JsonObject = d
        Exit Function
    End If

    Do
        JsonSkipWs s, p
        keyName = JsonString(s, p)
        JsonSkipWs s, p
        If Mid$(s, p, 1) <> ":" Then Err.Raise vbObjectError + 61, , "JSON: ':' がありません（位置 " & p & "）"
        p = p + 1

        JsonValueInto s, p, v
        If IsObject(v) Then Set d(keyName) = v Else d(keyName) = v

        JsonSkipWs s, p
        If Mid$(s, p, 1) = "," Then
            p = p + 1
        ElseIf Mid$(s, p, 1) = "}" Then
            p = p + 1
            Exit Do
        Else
            Err.Raise vbObjectError + 62, , "JSON: ',' か '}' がありません（位置 " & p & "）"
        End If
    Loop

    Set JsonObject = d
End Function

Private Function JsonArray(ByRef s As String, ByRef p As Long) As Collection
    Dim c As Collection, v As Variant

    Set c = New Collection
    p = p + 1                                   ' [
    JsonSkipWs s, p
    If Mid$(s, p, 1) = "]" Then
        p = p + 1
        Set JsonArray = c
        Exit Function
    End If

    Do
        JsonValueInto s, p, v
        If IsObject(v) Then c.Add v Else c.Add v

        JsonSkipWs s, p
        If Mid$(s, p, 1) = "," Then
            p = p + 1
        ElseIf Mid$(s, p, 1) = "]" Then
            p = p + 1
            Exit Do
        Else
            Err.Raise vbObjectError + 63, , "JSON: ',' か ']' がありません（位置 " & p & "）"
        End If
    Loop

    Set JsonArray = c
End Function

Private Function JsonString(ByRef s As String, ByRef p As Long) As String
    Dim sb As String, ch As String, code As String

    If Mid$(s, p, 1) <> """" Then Err.Raise vbObjectError + 64, , "JSON: 文字列ではありません（位置 " & p & "）"
    p = p + 1

    Do While p <= Len(s)
        ch = Mid$(s, p, 1)
        If ch = """" Then
            p = p + 1
            JsonString = sb
            Exit Function
        ElseIf ch = "\" Then
            p = p + 1
            ch = Mid$(s, p, 1)
            Select Case ch
                Case "n": sb = sb & vbLf
                Case "r": sb = sb & vbCr
                Case "t": sb = sb & vbTab
                Case "b": sb = sb & Chr$(8)
                Case "f": sb = sb & Chr$(12)
                Case "u"
                    code = Mid$(s, p + 1, 4)
                    sb = sb & ChrW$(CLng("&H" & code))
                    p = p + 4
                Case Else: sb = sb & ch
            End Select
            p = p + 1
        Else
            sb = sb & ch
            p = p + 1
        End If
    Loop

    Err.Raise vbObjectError + 65, , "JSON: 文字列が閉じていません"
End Function

Private Function JsonLiteral(ByRef s As String, ByRef p As Long) As Variant
    Dim st As Long, t As String

    st = p
    Do While p <= Len(s)
        If InStr(",]} " & vbTab & vbCr & vbLf, Mid$(s, p, 1)) > 0 Then Exit Do
        p = p + 1
    Loop
    t = Trim$(Mid$(s, st, p - st))

    Select Case LCase$(t)
        Case "true": JsonLiteral = True
        Case "false": JsonLiteral = False
        Case "null": JsonLiteral = Null
        Case Else
            If IsNumeric(t) Then
                JsonLiteral = CDbl(t)
            Else
                JsonLiteral = t
            End If
    End Select
End Function

Private Sub JsonSkipWs(ByRef s As String, ByRef p As Long)
    Do While p <= Len(s)
        Select Case Mid$(s, p, 1)
            Case " ", vbTab, vbCr, vbLf: p = p + 1
            Case Else: Exit Do
        End Select
    Loop
End Sub

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
