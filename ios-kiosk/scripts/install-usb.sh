#!/bin/bash
# Install HomeKiosk only; replacement requires --replace and preserves a backup.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ $# -lt 1 || $# -gt 2 || ! -f "$1" ]]; then
  echo "Usage: bash $0 /absolute/path/to/private/known_hosts [--replace]" >&2
  exit 1
fi
known_hosts="$1"
replace=0
if [[ ${2:-} == --replace ]]; then replace=1
elif [[ $# == 2 ]]; then echo 'Unknown option' >&2; exit 1; fi
app="build/Payload/HomeKiosk.app"
test -f "$app/HomeKiosk"
test -f "$app/Info.plist"
test -f "$app/test.html"
test -f build/Entitlements.plist
plutil -lint build/Entitlements.plist
[[ $(plutil -extract CFBundleIdentifier raw "$app/Info.plist") == dev.darrenwaring.homekiosk ]]
# Do not include AppleDouble files or Mac extended attributes in the transport.
COPYFILE_DISABLE=1 tar -c --format ustar --no-xattrs --no-mac-metadata -f build/HomeKiosk-unsigned.tar -C build Payload/HomeKiosk.app Entitlements.plist
# SSH asks for the password interactively. Never add a password to this script.
# The uploaded archive contains only this public prototype, not dashboard data.
ssh_options=(-o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$known_hosts" -p 2244)
cat build/HomeKiosk-unsigned.tar | ssh "${ssh_options[@]}" root@127.0.0.1 "REPLACE=$replace "'
set -eu
command -v ldid
command -v uicache
if test -e /Applications/HomeKiosk.app; then
  test "$REPLACE" = 1
  test ! -L /Applications/HomeKiosk.app
  uicache -l dev.darrenwaring.homekiosk | grep -F "Path: /Applications/HomeKiosk.app"
fi
stage=$(mktemp -d /var/tmp/homekiosk.XXXXXX)
chmod 700 "$stage"
tar -xf - -C "$stage"
app="$stage/Payload/HomeKiosk.app"
test -f "$app/HomeKiosk"
ldid -S"$stage/Entitlements.plist" "$app/HomeKiosk"
echo "Signed entitlements (app identifier and container requirement only):"
ldid -e "$app/HomeKiosk"
echo "Signed code hash:"
ldid -h "$app/HomeKiosk"
chown -R root:wheel "$app"
chmod 755 "$app" "$app/HomeKiosk"
chmod 644 "$app/Info.plist" "$app/test.html" "$app"/*.png
if test -e /Applications/HomeKiosk.app; then
  # Stop only our app, never SpringBoard or a shared WebKit process.
  killall HomeKiosk 2>/dev/null || true
  backup=$(mktemp -d /var/tmp/homekiosk-backup.XXXXXX)
  chmod 700 "$backup"
  mv /Applications/HomeKiosk.app "$backup/HomeKiosk.app"
  echo "Previous app preserved at $backup/HomeKiosk.app"
fi
mv "$app" /Applications/HomeKiosk.app
uicache -p /Applications/HomeKiosk.app
uicache -l dev.darrenwaring.homekiosk
echo "Installed. Tap Home Kiosk on the iPad to test launch. No reboot or respring performed."
echo "Staging retained at $stage for inspection; no credentials are stored there."
'
