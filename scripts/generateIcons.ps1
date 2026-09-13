# scripts/generateIcons.ps1
# Generates all multiplatform application icon assets from the root PauseFlow icon.png

Add-Type -AssemblyName System.Drawing

$rootDir = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $rootDir "icon.png"

if (-not (Test-Path $sourcePath)) {
    Write-Error "Source icon.png not found at $sourcePath"
    exit 1
}

function Resize-Png($src, $dest, $w, $h) {
    $img = [System.Drawing.Bitmap]::FromFile($src)
    $canvas = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($img, 0, 0, $w, $h)
    
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    $canvas.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $canvas.Dispose()
    $img.Dispose()
    Write-Host "Generated: $dest (${w}x${h})"
}

function Create-Ico($src, $destPath) {
    # Create multi-resolution ICO (256, 128, 64, 48, 32, 24, 16)
    $sizes = @(256, 128, 64, 48, 32, 24, 16)
    $pngBuffers = @()

    foreach ($s in $sizes) {
        $img = [System.Drawing.Bitmap]::FromFile($src)
        $canvas = New-Object System.Drawing.Bitmap($s, $s)
        $g = [System.Drawing.Graphics]::FromImage($canvas)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.DrawImage($img, 0, 0, $s, $s)
        
        $ms = New-Object System.IO.MemoryStream
        $canvas.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBuffers += ,@($s, $ms.ToArray())
        $ms.Dispose()
        $g.Dispose()
        $canvas.Dispose()
        $img.Dispose()
    }

    $destDir = Split-Path -Parent $destPath
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    $fs = [System.IO.File]::Create($destPath)
    $bw = New-Object System.IO.BinaryWriter($fs)

    # ICONDIR header: Reserved (0), Type (1 for ICO), Count
    $bw.Write([uint16]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]$pngBuffers.Count)

    # Header size = 6, each ICONDIRENTRY = 16 bytes
    $offset = 6 + (16 * $pngBuffers.Count)

    # Write ICONDIRENTRY list
    foreach ($entry in $pngBuffers) {
        $s = $entry[0]
        $bytes = $entry[1]
        $bWidth = if ($s -ge 256) { [byte]0 } else { [byte]$s }
        $bHeight = if ($s -ge 256) { [byte]0 } else { [byte]$s }

        $bw.Write($bWidth)           # Width
        $bw.Write($bHeight)          # Height
        $bw.Write([byte]0)           # Color count
        $bw.Write([byte]0)           # Reserved
        $bw.Write([uint16]1)         # Color planes
        $bw.Write([uint16]32)        # Bits per pixel
        $bw.Write([uint32]$bytes.Length) # Image size in bytes
        $bw.Write([uint32]$offset)   # Image offset
        $offset += $bytes.Length
    }

    # Write Image Data (PNG streams)
    foreach ($entry in $pngBuffers) {
        $bytes = $entry[1]
        $bw.Write($bytes)
    }

    $bw.Flush()
    $bw.Close()
    $fs.Close()
    Write-Host "Generated Windows ICO: $destPath"
}

Write-Host "--- Generating Desktop Icons ---"
Resize-Png $sourcePath (Join-Path $rootDir "desktop/appIcon.png") 512 512
Resize-Png $sourcePath (Join-Path $rootDir "desktop/trayIcon.png") 32 32
Create-Ico $sourcePath (Join-Path $rootDir "desktop/icon.ico")
Create-Ico $sourcePath (Join-Path $rootDir "public/favicon.ico")

Write-Host "--- Generating Web / PWA Icons ---"
Resize-Png $sourcePath (Join-Path $rootDir "public/icon.png") 512 512
Resize-Png $sourcePath (Join-Path $rootDir "public/favicon.png") 64 64
Resize-Png $sourcePath (Join-Path $rootDir "public/favicon-192.png") 192 192
Resize-Png $sourcePath (Join-Path $rootDir "public/favicon-512.png") 512 512

Write-Host "--- Generating Android Mipmap Icons ---"
$androidRes = Join-Path $rootDir "android/app/src/main/res"

# mdpi
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-mdpi/ic_launcher.png") 48 48
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-mdpi/ic_launcher_round.png") 48 48
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-mdpi/ic_launcher_foreground.png") 108 108

# hdpi
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-hdpi/ic_launcher.png") 72 72
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-hdpi/ic_launcher_round.png") 72 72
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-hdpi/ic_launcher_foreground.png") 162 162

# xhdpi
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-xhdpi/ic_launcher.png") 96 96
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-xhdpi/ic_launcher_round.png") 96 96
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-xhdpi/ic_launcher_foreground.png") 216 216

# xxhdpi
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-xxhdpi/ic_launcher.png") 144 144
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-xxhdpi/ic_launcher_round.png") 144 144
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-xxhdpi/ic_launcher_foreground.png") 324 324

# xxxhdpi
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-xxxhdpi/ic_launcher.png") 192 192
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-xxxhdpi/ic_launcher_round.png") 192 192
Resize-Png $sourcePath (Join-Path $androidRes "mipmap-xxxhdpi/ic_launcher_foreground.png") 432 432

Write-Host "=== All multiplatform icon assets successfully generated from PauseFlow icon.png ==="
