#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! sdk_path=$(xcrun --sdk iphoneos --show-sdk-path); then
  echo 'Cannot access iPhoneOS SDK. Check Xcode selection, license and first-run setup above; see README.md.' >&2
  exit 1
fi
minimum_target=$(plutil -extract SupportedTargets.iphoneos.MinimumDeploymentTarget raw "$sdk_path/SDKSettings.plist")
if [[ "$minimum_target" != 12.* && "$minimum_target" != 11.* ]]; then
  echo "SDK minimum deployment target is $minimum_target; this prototype requires iOS 12 support." >&2
  echo 'Select a compatible official Xcode; do not lower the SDK metadata or raise the app target.' >&2
  exit 1
fi
app="$PWD/build/Payload/HomeKiosk.app"
mkdir -p "$app"
xcrun --sdk iphoneos clang -arch arm64 -isysroot "$sdk_path" \
  -miphoneos-version-min=12.0 -fobjc-arc -fmodules -Wall -Wextra \
  -Werror=unguarded-availability -O2 Sources/main.m Sources/KioskController.m \
  -framework UIKit -framework Foundation -framework WebKit -o "$app/HomeKiosk"
cp Info.plist "$app/Info.plist"
cp Resources/test.html "$app/test.html"
cp Resources/loading-diagnostics.js "$app/loading-diagnostics.js"
cp Entitlements.plist build/Entitlements.plist
python3 scripts/build-icons.py
plutil -lint "$app/Info.plist"
xcrun vtool -show-build "$app/HomeKiosk"
echo "Unsigned bundle: $app"
echo 'Use install-usb.sh to sign/register on the tested jailbroken device; see README.md.'
