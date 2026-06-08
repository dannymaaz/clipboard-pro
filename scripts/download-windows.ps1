param(
  [string]$Repository = "OWNER/clipboard-pro",
  [string]$Asset = "*Clipboard*Pro*.msi"
)

$ErrorActionPreference = "Stop"
$release = Invoke-RestMethod "https://api.github.com/repos/$Repository/releases/latest"
$assetInfo = $release.assets | Where-Object { $_.name -like $Asset } | Select-Object -First 1

if (-not $assetInfo) {
  throw "No Windows installer matching '$Asset' was found in the latest release."
}

$output = Join-Path $PWD $assetInfo.name
Invoke-WebRequest -Uri $assetInfo.browser_download_url -OutFile $output
Write-Host "Downloaded $output"
