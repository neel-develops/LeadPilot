param([string]$Only = "")
$ErrorActionPreference = "Stop"
$Deck = Join-Path $PSScriptRoot "Paytm-AI-Hackathon-LeadPilot.pptx"
$OutDir = Join-Path $PSScriptRoot "qa"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$pp = New-Object -ComObject PowerPoint.Application
try {
  # ReadOnly, Untitled, WithWindow = false
  $p = $pp.Presentations.Open($Deck, -1, 0, 0)
  "slides: " + $p.Slides.Count
  foreach ($s in $p.Slides) {
    if ($Only -ne "" -and -not ($Only.Split(",") -contains [string]$s.SlideIndex)) { continue }
    $f = Join-Path $OutDir ("slide-{0:D2}.png" -f $s.SlideIndex)
    $s.Export($f, "PNG", 1600, 900)
  }
  $p.Close()
  "exported"
} finally {
  $pp.Quit()
}
