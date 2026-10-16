Add-Type -AssemblyName System.Drawing

$root = "C:\Users\Roman\Desktop\armwrestling\public\handles"
$outDir = "C:\Users\Roman\Desktop\armwrestling\public\media"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Save-Jpeg([string]$src, [string]$dest, [int]$maxW, [int]$quality) {
  $img = [System.Drawing.Image]::FromFile($src)
  try {
    $ratio = [Math]::Min(1.0, $maxW / $img.Width)
    $w = [Math]::Max(1, [int]($img.Width * $ratio))
    $h = [Math]::Max(1, [int]($img.Height * $ratio))
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    try {
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($img, 0, 0, $w, $h)
      } finally {
        $g.Dispose()
      }
      $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
      $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
      $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [int64]$quality)
      $bmp.Save($dest, $codec, $ep)
    } finally {
      $bmp.Dispose()
    }
  } finally {
    $img.Dispose()
  }
  Write-Output "$dest"
}

$exact = @{
  "thin-handle.jpg" = @{ Out = "thin-handle.jpg"; W = 720; Q = 74 }
  "cylindrical-handle.jpg" = @{ Out = "cylindrical-handle.jpg"; W = 720; Q = 74 }
  "eccentric-handle.jpg" = @{ Out = "eccentric-handle.jpg"; W = 720; Q = 74 }
  "multi-spinner(standard).jpg" = @{ Out = "multi-spinner-standard.jpg"; W = 720; Q = 74 }
  "multi-spinner(thick).jpg" = @{ Out = "multi-spinner-thick.jpg"; W = 720; Q = 74 }
  "strap-handle.jpg" = @{ Out = "strap-handle.jpg"; W = 720; Q = 74 }
  "armwrestling-belt.jpg" = @{ Out = "armwrestling-belt.jpg"; W = 720; Q = 74 }
  "resistance-bands.jpg" = @{ Out = "resistance-bands.jpg"; W = 1100; Q = 74 }
  "pulley-block.jpg" = @{ Out = "pulley-block.jpg"; W = 800; Q = 74 }
  "table1.jpg" = @{ Out = "table-bg.jpg"; W = 1600; Q = 68 }
  "table2.jpg" = @{ Out = "table-side.jpg"; W = 1200; Q = 70 }
}

Get-ChildItem $root -Filter *.jpg | ForEach-Object {
  $name = $_.Name
  if ($exact.ContainsKey($name)) {
    $item = $exact[$name]
    Save-Jpeg $_.FullName (Join-Path $outDir $item.Out) $item.W $item.Q
  } elseif ($name -like "*40kg*") {
    Save-Jpeg $_.FullName (Join-Path $outDir "gripper-40.jpg") 720 74
  } elseif ($name -like "*CoC*") {
    Save-Jpeg $_.FullName (Join-Path $outDir "gripper-coc3.jpg") 720 74
  } else {
    Write-Output "SKIP $name"
  }
}
