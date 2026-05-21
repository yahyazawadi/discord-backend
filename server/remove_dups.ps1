$f = 'c:\Users\CLICK\Desktop\discord\server\public\index.html'
$lines = [System.IO.File]::ReadAllLines($f)
# Remove lines 4198-4322 (0-indexed): the leftover old toggleCamera + toggleScreenShare block
# Find where the old block ends by looking for addVideoStream (the function after)
$keep = $lines[0..4197] + $lines[4322..($lines.Length - 1)]
[System.IO.File]::WriteAllLines($f, $keep, [System.Text.UTF8Encoding]::new($false))
Write-Host "Done. New line count: $($keep.Length)"
