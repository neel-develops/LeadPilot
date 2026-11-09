$ErrorActionPreference = "Stop"
$src = Join-Path $PSScriptRoot "Hackathon-Template-PARAM-Light.pptx"
$out = Join-Path $PSScriptRoot "qa"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$pp = New-Object -ComObject PowerPoint.Application
try {
  $p = $pp.Presentations.Open($src, -1, 0, 0)
  foreach ($s in $p.Slides) {
    # layout placeholders (in order), excluding the slide number
    $prompts = @()
    foreach ($ls in $s.CustomLayout.Shapes) {
      if ($ls.Type -eq 14 -and $ls.PlaceholderFormat.Type -ne 13 -and $ls.HasTextFrame) { $prompts += $ls.TextFrame.TextRange.Text }
    }
    $i = 0
    foreach ($sh in $s.Shapes) {
      if ($sh.Type -eq 14 -and $sh.PlaceholderFormat.Type -ne 13 -and $sh.HasTextFrame) {
        if ($i -lt $prompts.Count) { $sh.TextFrame.TextRange.Text = $prompts[$i] }
        $i++
      }
    }
    $s.Export((Join-Path $out ("t-{0:D2}.png" -f $s.SlideIndex)), "PNG", 1600, 900)
  }
  $p.Close()
  "rendered"
} finally { $pp.Quit() }
