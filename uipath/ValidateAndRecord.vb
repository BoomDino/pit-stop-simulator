Dim result As New Newtonsoft.Json.Linq.JObject()
result("success") = False
Dim temporary As String = Nothing
Try
    Dim ev = Newtonsoft.Json.Linq.JObject.Parse(eventJson)
    Dim eid As String = CStr(ev("event_id"))
    Dim run As String = CStr(ev("run_id"))
    Dim player As String = CStr(ev("player_id"))
    Dim stage As Integer = CInt(ev("stage"))
    result("event_id") = eid
    result("stage") = stage
    Dim parsedId As System.Guid
    If Not System.Guid.TryParse(eid, parsedId) OrElse Not System.Guid.TryParse(run, parsedId) Then Throw New System.Exception("Invalid event/run ID")
    If String.IsNullOrWhiteSpace(player) Then Throw New System.Exception("Missing player ID")
    If stage < 1 OrElse stage > 6 Then Throw New System.Exception("Invalid stage")
    Dim wheels As String() = {"", "FRONT_LEFT", "FRONT_RIGHT", "REAR_LEFT", "REAR_RIGHT", ""}
    Dim wheel As String = If(CStr(ev("wheel_position")), "")
    Dim expected As String = If(stage = 1, "DOCK_IN", If(stage = 6, "DOCK_OUT", "TYRE_REPLACED"))
    If wheel <> wheels(stage - 1) Then Throw New System.Exception("Invalid wheel position for stage")
    If CStr(ev("event")) <> expected OrElse CStr(ev("status")) <> "SUCCESS" Then Throw New System.Exception("Invalid event/status")
    Dim elapsed As Double = CDbl(ev("execution_time"))
    Dim score As Integer = CInt(ev("player_score"))
    If Double.IsNaN(elapsed) OrElse Double.IsInfinity(elapsed) OrElse elapsed < 0 OrElse elapsed > 86400 OrElse score < 0 OrElse score > 600 Then Throw New System.Exception("Invalid score/time")
    Dim stamp = System.DateTimeOffset.Parse(CStr(ev("timestamp")), System.Globalization.CultureInfo.InvariantCulture)
    Dim outputDir As String = System.Environment.GetEnvironmentVariable("PITSTOP_LOG_DIR")
    If String.IsNullOrWhiteSpace(outputDir) Then Throw New System.Exception("Set PITSTOP_LOG_DIR to a persistent robot-writable directory")
    System.IO.Directory.CreateDirectory(outputDir)
    Dim workbook As String = System.IO.Path.Combine(outputDir, "PitStop_Execution_Log.xlsx")
    ' Exclusive cross-process lock protects sequence and workbook together.
    Using gate As New System.IO.FileStream(workbook & ".lock", System.IO.FileMode.OpenOrCreate, System.IO.FileAccess.ReadWrite, System.IO.FileShare.None)
        Dim ns As System.Xml.Linq.XNamespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
        Dim doc As System.Xml.Linq.XDocument
        If System.IO.File.Exists(workbook) Then
            Using input As New System.IO.FileStream(workbook, System.IO.FileMode.Open, System.IO.FileAccess.Read, System.IO.FileShare.Read)
                Using archive As New System.IO.Compression.ZipArchive(input, System.IO.Compression.ZipArchiveMode.Read)
                    Using sheetStream = archive.GetEntry("xl/worksheets/sheet1.xml").Open()
                        doc = System.Xml.Linq.XDocument.Load(sheetStream)
                    End Using
                End Using
            End Using
        Else
            doc = System.Xml.Linq.XDocument.Parse("<worksheet xmlns=""http://schemas.openxmlformats.org/spreadsheetml/2006/main""><sheetData><row r=""1""><c r=""A1"" t=""inlineStr""><is><t>Timestamp</t></is></c><c r=""B1"" t=""inlineStr""><is><t>Player ID</t></is></c><c r=""C1"" t=""inlineStr""><is><t>Event</t></is></c><c r=""D1"" t=""inlineStr""><is><t>Wheel Position</t></is></c><c r=""E1"" t=""inlineStr""><is><t>Status</t></is></c><c r=""F1"" t=""inlineStr""><is><t>Execution Time</t></is></c><c r=""G1"" t=""inlineStr""><is><t>Score</t></is></c><c r=""H1"" t=""inlineStr""><is><t>Robot Result</t></is></c><c r=""I1"" t=""inlineStr""><is><t>Run ID</t></is></c><c r=""J1"" t=""inlineStr""><is><t>Event ID</t></is></c><c r=""K1"" t=""inlineStr""><is><t>Stage</t></is></c></row></sheetData></worksheet>")
        End If
        Dim sheet = doc.Root.Element(ns + "sheetData")
        Dim prior As Integer = 0
        Dim duplicate As Boolean = False
        For Each row As System.Xml.Linq.XElement In sheet.Elements(ns + "row")
            If CStr(row.Attribute("r")) = "1" Then Continue For
            Dim values As New System.Collections.Generic.List(Of String)
            For Each cell As System.Xml.Linq.XElement In row.Elements(ns + "c")
                values.Add(cell.Value)
            Next
            If values.Count <> 11 Then Throw New System.Exception("Workbook schema changed; restore expected 11 columns")
            If values(9) = eid Then
                If values(8) <> run OrElse values(10) <> stage.ToString() OrElse values(1) <> player OrElse values(2) <> expected OrElse values(3) <> wheel OrElse values(6) <> score.ToString(System.Globalization.CultureInfo.InvariantCulture) OrElse values(5) <> elapsed.ToString(System.Globalization.CultureInfo.InvariantCulture) Then Throw New System.Exception("Duplicate event has different data")
                duplicate = True
            End If
            If values(8) = run Then
                If values(1) <> player Then Throw New System.Exception("Run player mismatch")
                prior = System.Math.Max(prior, Integer.Parse(values(10)))
            End If
        Next
        If Not duplicate Then
            If stage <> prior + 1 Then Throw New System.Exception("Incorrect pit-stop sequence; expected stage " & (prior + 1).ToString())
            Dim rowNumber As Integer = 1
            For Each existingRow As System.Xml.Linq.XElement In sheet.Elements(ns + "row")
                rowNumber += 1
            Next
            Dim values As String() = {stamp.ToString("o"), player, expected, wheel, "SUCCESS", elapsed.ToString(System.Globalization.CultureInfo.InvariantCulture), score.ToString(System.Globalization.CultureInfo.InvariantCulture), "Validated and recorded by UiPath", run, eid, stage.ToString()}
            Dim newRow As New System.Xml.Linq.XElement(ns + "row", New System.Xml.Linq.XAttribute("r", rowNumber))
            For i As Integer = 0 To values.Length - 1
                newRow.Add(New System.Xml.Linq.XElement(ns + "c", New System.Xml.Linq.XAttribute("r", ChrW(65 + i) & rowNumber.ToString()), New System.Xml.Linq.XAttribute("t", "inlineStr"), New System.Xml.Linq.XElement(ns + "is", New System.Xml.Linq.XElement(ns + "t", values(i)))))
            Next
            sheet.Add(newRow)
            temporary = workbook & "." & System.Guid.NewGuid().ToString("N") & ".tmp"
            Using output As New System.IO.FileStream(temporary, System.IO.FileMode.CreateNew)
                Using archive As New System.IO.Compression.ZipArchive(output, System.IO.Compression.ZipArchiveMode.Create)
                    Dim entries As New System.Collections.Generic.Dictionary(Of String, String) From {{"[Content_Types].xml", "<?xml version=""1.0"" encoding=""utf-8""?><Types xmlns=""http://schemas.openxmlformats.org/package/2006/content-types""><Default Extension=""rels"" ContentType=""application/vnd.openxmlformats-package.relationships+xml""/><Default Extension=""xml"" ContentType=""application/xml""/><Override PartName=""/xl/workbook.xml"" ContentType=""application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml""/><Override PartName=""/xl/worksheets/sheet1.xml"" ContentType=""application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml""/></Types>"}, {"_rels/.rels", "<Relationships xmlns=""http://schemas.openxmlformats.org/package/2006/relationships""><Relationship Id=""rId1"" Type=""http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"" Target=""xl/workbook.xml""/></Relationships>"}, {"xl/workbook.xml", "<workbook xmlns=""http://schemas.openxmlformats.org/spreadsheetml/2006/main"" xmlns:r=""http://schemas.openxmlformats.org/officeDocument/2006/relationships""><sheets><sheet name=""Execution Log"" sheetId=""1"" r:id=""rId1""/></sheets></workbook>"}, {"xl/_rels/workbook.xml.rels", "<Relationships xmlns=""http://schemas.openxmlformats.org/package/2006/relationships""><Relationship Id=""rId1"" Type=""http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"" Target=""worksheets/sheet1.xml""/></Relationships>"}}
                    For Each part In entries
                        Using writer As New System.IO.StreamWriter(archive.CreateEntry(part.Key).Open(), New System.Text.UTF8Encoding(False))
                            writer.Write(part.Value)
                        End Using
                    Next
                    Using sheetStream = archive.CreateEntry("xl/worksheets/sheet1.xml").Open()
                        doc.Save(sheetStream)
                    End Using
                End Using
            End Using
            If System.IO.File.Exists(workbook) Then
                System.IO.File.Replace(temporary, workbook, Nothing)
            Else
                System.IO.File.Move(temporary, workbook)
            End If
        End If
        result("success") = True
        result("message") = If(duplicate, "Previously recorded event confirmed", "Sequence validated and Excel row committed")
        result("workbook") = workbook
    End Using
Catch ex As System.Exception
    result("message") = ex.Message
Finally
    If temporary IsNot Nothing AndAlso System.IO.File.Exists(temporary) Then System.IO.File.Delete(temporary)
End Try
resultJson = result.ToString(Newtonsoft.Json.Formatting.None)
