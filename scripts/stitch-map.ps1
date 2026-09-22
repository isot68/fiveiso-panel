$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$mapDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'map'
$tileSize = 1080
$bitmap = [System.Drawing.Bitmap]::new($tileSize * 2, $tileSize * 3, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  for ($row = 0; $row -lt 3; $row++) {
    for ($column = 0; $column -lt 2; $column++) {
      $path = Join-Path $mapDirectory "minimap_sea_${row}_${column}.png"
      $tile = [System.Drawing.Image]::FromFile($path)
      try {
        if ($tile.Width -ne $tileSize -or $tile.Height -ne $tileSize) {
          throw "Harita parçasının ölçüsü beklenenden farklı: $path"
        }
        $graphics.DrawImageUnscaled($tile, $column * $tileSize, $row * $tileSize)
      } finally {
        $tile.Dispose()
      }
    }
  }
  $bitmap.Save((Join-Path $mapDirectory 'minimap-stitched.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}
