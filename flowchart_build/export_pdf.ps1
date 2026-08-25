$src = "C:\batuan-voting\Batuan_Voting_System_Flowcharts_Master.docx"
$pdf1 = "C:\batuan-voting\Batuan_Voting_System_Flowcharts.pdf"
$pdf2 = "C:\Users\johnley\Downloads\Batuan_Voting_System_Flowcharts.pdf"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $doc = $word.Documents.Open($src)
    $doc.SaveAs([ref]$pdf1, [ref]17)
    $doc.SaveAs([ref]$pdf2, [ref]17)
    $doc.Close()
    Write-Host "PDF successfully exported!"
}
catch {
    Write-Host "Error during export: $_"
}
finally {
    $word.Quit()
}
