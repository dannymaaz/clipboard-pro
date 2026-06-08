#!/usr/bin/env sh
set -eu

REPOSITORY="${1:-OWNER/clipboard-pro}"
ASSET_PATTERN="${2:-.*Clipboard.*Pro.*\\.dmg$}"

ASSET_URL="$(curl -fsSL "https://api.github.com/repos/${REPOSITORY}/releases/latest" \
  | node -e "const fs=require('fs'); const release=JSON.parse(fs.readFileSync(0,'utf8')); const pattern=new RegExp(process.argv[1]); const asset=release.assets.find((item)=>pattern.test(item.name)); if(!asset) process.exit(1); console.log(asset.browser_download_url)" "$ASSET_PATTERN")"

curl -fL "$ASSET_URL" -o clipboard-pro-macos.dmg
printf '%s\n' "Downloaded clipboard-pro-macos.dmg"
