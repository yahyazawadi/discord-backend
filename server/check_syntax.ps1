$html = Get-Content 'c:\Users\CLICK\Desktop\discord\server\public\index.html' -Raw
$match = [regex]::Match($html, '(?s)<script>(.*?)</script>')
if ($match.Success) {
    $js = $match.Groups[1].Value
    $jsFile = 'c:\Users\CLICK\Desktop\discord\server\__sc__.js'
    [System.IO.File]::WriteAllText($jsFile, $js)
    $result = node --check $jsFile 2>&1
    Remove-Item $jsFile -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SYNTAX OK"
    } else {
        Write-Host "SYNTAX ERROR:"
        $result
    }
} else {
    Write-Host "No script block found"
}
