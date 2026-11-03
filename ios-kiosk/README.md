# Home Kiosk

Small Objective-C/UIKit/WKWebView wrapper for the hosted dashboard. Target:
iPad mini 3 Wi-Fi, iPad4,7, A7 arm64, iOS 12.5.8. No web framework migration,
bundled dashboard, third-party runtime or always-on development machine.

## Verified on 2026-11-03

- Built with official Xcode 15.4 (15F31d), iPhoneOS 17.5 SDK, on arm64 macOS
  27.0.1 (26A434). Binary inspection: platform IOS, arm64, minimum OS 12.0,
  Apple system libraries only. General Xcode IDE compatibility is untested.
- Signed on the iPad using installed ldid 2:2.1.4-1, registered using
  uikittools 1.1.20-1. No new jailbreak packages, reboot or respring.
- Initial prototype installed and launched. User verified bundled page rendering,
  JavaScript and touch. Device process inspection also confirmed HomeKiosk running.
- Version 0.2 kiosk controls built and installed with a rollback copy of 0.1.
  URL persistence, retry timing, idle control and the maintenance gesture still
  need individual device verification.
- The user reached the Access page; Cloudflare-account sign-in then spun
  indefinitely. Exact JavaScript/network failure is not diagnosed.
- With explicit user approval, added hostname-specific email-PIN Access for the
  dashboard, restricted to the owner address with a 24-hour application session.
  The original Worker-wide member protection was retained. Verified the public
  protected URL returns the Email / Send login code form using an iPad user-agent.
  The user completed PIN sign-in on the iPad, then reported broken dashboard UI.
  Web compatibility fixes are tracked in `../docs/ios-web-compatibility.md`.
  No authentication codes or service secrets are in source.

## Build

Use the official Xcode 15.4 installation alongside newer Xcode:

```sh
DEVELOPER_DIR=/Applications/Xcode-15.4.app/Contents/Developer bash ios-kiosk/scripts/build.sh
```

Produces ignored `ios-kiosk/build/Payload/HomeKiosk.app` and prints its minimum OS
metadata. Python 3 standard library generates opaque iPad house icons. No Swift
runtime is used. The bundle on the Mac is unsigned; the install script signs on
the device. Clang needs access to its user module cache outside the workspace.

Xcode 27.2 is also installed but its SDK declares minimum target 15.0. The script
rejects incompatible SDKs. Xcode 15.4's CLI worked on this Mac despite duplicate
private-framework warnings during SDK discovery; no system frameworks were changed.
Apple lists Sonoma as its supported host. Obtain tools only from
[Apple Developer downloads](https://developer.apple.com/download/all/).
Do not modify SDK metadata or download unofficial SDK archives.

## USB installation and update

Inspect before starting another forward. The tested localhost-only command is:

```sh
iproxy -s 127.0.0.1 -l 2244:44
```

Use an existing private known-hosts file and verify the host key. Authenticate
interactively; never embed passwords in source, scripts or command arguments.

```sh
ssh -o UserKnownHostsFile=/path/to/private/known_hosts -p 2244 root@127.0.0.1
bash ios-kiosk/scripts/install-usb.sh /path/to/private/known_hosts
# Explicit update, preserving the previous bundle:
bash ios-kiosk/scripts/install-usb.sh /path/to/private/known_hosts --replace
```

The script packages a tar archive without Mac metadata, stages it privately on
the iPad, signs with the checked-in Entitlements.plist, and uses `uicache -p` for
the single `/Applications/HomeKiosk.app` path. This is a jailbreak-specific method,
not an App Store IPA installation. Version 0.1 launched with an empty entitlement
set; version 0.2 requests only its application identifier and **container-required
true**. It grants no platform, no-container, debugger or shared-keychain access.

Updates stop only HomeKiosk, preserve its old bundle under a private
`/var/tmp/homekiosk-backup.*` directory, and register the replacement. Staging
is retained for inspection. No system apps or packages are removed. Launch by
tapping **Home Kiosk**; SSH copying/registration alone does not prove launch.

The installed uicache reports `/var/mobile` as the container path. That report
does not establish runtime isolation. Version 0.2 checks its actual Foundation
home and blocks remote loading unless it is an app-specific data container.
Maintenance reports whether that check passed. Do not remove this guard just to
make sign-in work. Runtime container and cookie persistence need device checks.

Rollback requires closing HomeKiosk, moving the replacement aside, restoring the
specific saved app bundle, then registering `/Applications/HomeKiosk.app` again.
Uninstall by unregistering only that path using `uicache -u`, then removing only
the app bundle. Inspect any app data container before deleting data. Never remove
shared `/var/mobile` data or change bootstrap packages for rollback.

## Kiosk controls

Version 0.3 adds an asset-loading diagnostic after the user reported an unstyled
dashboard after deployment. On dashboard page completion it records only document
readiness, whether App exists, stage display/position, stylesheet count, and
same-origin hashed asset status/MIME/size/HTML classification. It never records
page text, forms, cookies, response bodies or URL queries. The private report is
`Library/Caches/homekiosk-loading.json` in the app's runtime home. Maintenance's
**Inspect asset loading** button repeats the check. It is diagnostic evidence,
not a compatibility fix. No web/Access policy change accompanies this app update.

Defaults to `https://home-dashboard.darrenwaring.workers.dev/#home`.
Hold **three fingers for two seconds** anywhere to open maintenance. This is
concealed access, not a security lock. Loading/error screens also have a visible
Maintenance button. The panel shows the configured URL and basic status, edits
and saves the URL, reloads the configured dashboard, or opens the offline test.

The web view fills the screen in landscape with the status bar hidden. Normal
pinch, scrolling and touch remain enabled. Idle sleep is disabled while active
and the previous idle setting is restored on resigning active. Persistent
WKWebsiteDataStore retains cookies independently of Safari. No cookie transfer,
credential bridge, raw console capture or certificate override is implemented.

Automatic recovery retries after 2, 5 and 15 seconds, with at most three automatic
recoveries per rolling five minutes, including web-process termination. Successful
page loads do not reset this budget. Backgrounding or opening maintenance cancels
pending retries; manual reload resets the budget. HTTP 4xx responses require a
manual reload; server failures can use bounded retry. No app-crash or reboot
relaunch mechanism exists.

Configured origins stay in the same view. New top-level HTTPS origins, including
identity providers, require an on-screen confirmation displaying only their
origin. Approval lasts until the next manual dashboard load/app restart. Allowed
new-window requests open in this same view; non-web app schemes are blocked.
The app never opens external apps automatically or displays authentication query
parameters in status messages.

## LAN development

URL settings accept HTTPS, or HTTP to an unqualified / `.local` LAN hostname,
without credentials or query strings. The sole ATS exception is
`NSAllowsLocalNetworking`; there is no arbitrary-load or arbitrary-web-content
exception. Raw-IP HTTP is intentionally unsupported. TLS validation stays intact.
LAN connectivity and name resolution remain unverified on the iPad. Follow the
repository's localhost-only rule for Mac dashboard development; this wrapper does
not start or expose a LAN server. Hosted loading is the normal independent mode.

## Access and remaining checks

The original Cloudflare button leads to the Cloudflare account login web app;
the iPad stalls after selecting it. The approved email-PIN hostname application
avoids that login route while retaining Access. Enter the owner's email on the
iPad and enter its emailed code there. App, policy IDs and the permitted address
are private deployment records, not committed configuration. Hostname policies
take precedence over Worker-wide policies; other Worker URLs retain the original
protection. To roll back this login change, remove the hostname-specific app via
Cloudflare after review; keep the original Worker-wide app in place.

WKWebView still uses iOS 12 WebKit. Email-PIN login does not establish dashboard
JavaScript/CSS compatibility or verify integrations. See PROJECT.md for service
status. Test saved URL/cookies across app exit, loss of Wi-Fi, idle sleep,
web-process recovery, touch layout and long uptime. Login may need renewal after
session expiry; extending session duration needs a separate decision.

Safe Mode disables tweak injection. Guided Access is separate and untested.
Do not reboot to test installation: checkra1n is semi-tethered and a full reboot
requires Mac/DFU reactivation. Automatic startup and recovery after app exit or
full reboot are not implemented. Device flashing stays out of scope.
