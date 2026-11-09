$ErrorActionPreference = "Stop"
$pp = New-Object -ComObject PowerPoint.Application
try {
  $p = $pp.Presentations.Open((Join-Path $PSScriptRoot "Hackathon-Template-PARAM-Light.pptx"), -1, 0, 0)
  $p.SaveCopyAs((Join-Path $PSScriptRoot "Hackathon-Template-PARAM-Light.potx"), 26)
  $p.Close()
  "potx saved"
} finally { $pp.Quit() }
