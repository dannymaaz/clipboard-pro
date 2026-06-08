#!/usr/bin/env sh
set -eu

REPOSITORY="${1:-OWNER/clipboard-pro}"
FORMAT="${2:-appimage}"

case "$FORMAT" in
  appimage) ASSET_PATTERN=".*Clipboard.*Pro.*\\.AppImage$" ;;
  deb) ASSET_PATTERN=".*Clipboard.*Pro.*\\.deb$" ;;
  *) printf '%s\n' "Use appimage or deb"; exit 1 ;;
esac

ASSET_URL="$(curl -fsSL "https://api.github.com/repos/${REPOSITORY}/releases/latest" \
  | node -e "const fs=require('fs'); const release=JSON.parse(fs.readFileSync(0,'utf8')); const pattern=new RegExp(process.argv[1]); const asset=release.assets.find((item)=>pattern.test(item.name)); if(!asset) process.exit(1); console.log(asset.browser_download_url)" "$ASSET_PATTERN")"

OUTPUT="clipboard-pro-linux.${FORMAT}"
curl -fL "$ASSET_URL" -o "$OUTPUT"
printf '%s\n' "Downloaded $OUTPUT"
