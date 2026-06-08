param(
  [string]$Repository = "dannymaaz/clipboard-pro",
  [string]$Version = "v0.1.0"
)

Write-Host "Clipboard Pro GitHub release checklist"
Write-Host ""
Write-Host "1. Create the GitHub repository:"
Write-Host "   https://github.com/new"
Write-Host ""
Write-Host "2. Run these commands from the project root:"
Write-Host "   git init"
Write-Host "   git add ."
Write-Host "   git commit -m `"Initial Clipboard Pro MVP`""
Write-Host "   git branch -M main"
Write-Host "   git remote add origin https://github.com/$Repository.git"
Write-Host "   git push -u origin main"
Write-Host ""
Write-Host "3. Trigger the release workflow:"
Write-Host "   git tag $Version"
Write-Host "   git push origin $Version"
Write-Host ""
Write-Host "4. Download Windows installer after the workflow finishes:"
Write-Host "   gh release download --repo $Repository --pattern `"*.msi`""
