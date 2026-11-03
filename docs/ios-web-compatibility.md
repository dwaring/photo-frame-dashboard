# iPad WebKit compatibility

Target is the iPad mini 3 on iOS 12.5.8. The native wrapper uses system WebKit;
successful native launch and Access login do not establish web compatibility.
The user completed email-PIN sign-in and reported a broken dashboard UI.

The initial compatibility pass fixes these source-level blockers:

- Production JavaScript targeted Chrome 106, allowing syntax Safari 12 cannot
  parse. Vite now targets Chrome 106 and Safari 12. Test the production build;
  the Vite development module pipeline is not a legacy-browser compatibility test.
- Inactive views relied solely on `content-visibility`, leaving their contents
  visible in older browsers. `visibility` and pointer-event fallbacks now keep
  inactive views hidden while preserving their layout for prebuilding.
- The rail accepted touch only through Pointer Events and ignored ordinary touch
  clicks. Click navigation, hold gestures and calendar swipes now support Touch
  Events when Pointer Events are absent.
- Weather and task requests use APIs absent from this WebKit version. A small
  first-loaded compatibility module supplies `Promise.allSettled`,
  `Object.fromEntries` and `AbortSignal.timeout` when missing. iOS 12.5 already
  provides AbortController/AbortSignal. Modern implementations stay unchanged.
- Person tint colours now use comma-separated channels and legacy `rgba()`
  syntax, including runtime person styles.
- Flex gap support is measured using actual layout, since `CSS.supports('gap')`
  cannot distinguish Grid support from Flex support. On unsupported engines a
  batched observer adds main-axis margins, preserving original inline margins
  across rerenders. It does not run on browsers with native flex gap support.
  Wrapped-row spacing and auto-margin interactions still need visual inspection.

The Android-specific CSS target remains included to prevent the minifier from
emitting short-alpha hex colours rejected by the tablet. No authentication
policies, service secrets, web framework or data sources change in this patch.

Validation on 2026-11-03: production build and 12 tests across compatibility,
weather and chores passed. A syntax-only JavaScriptCore helper was compiled for
the iPad and staged privately; iOS killed it before it reported a result. This
does not establish a bundle syntax failure or success. No broader entitlements
or jailbreak package changes were attempted to make that helper run.

Deployed with explicit user authorization on 2026-11-03, Worker version
`70c40624-70d3-4f71-b8e9-8d105c5521bb`. Uploaded production assets are
`index-BlNG5h4j.css` and `index-9Og57IR_.js`. An unauthenticated iPad-user-agent
request still returns the protected email-code form. Device layout is unverified.

The first post-deploy device photo showed browser-default navigation buttons and
an otherwise empty page. This points to asset loading/startup as the next check,
rather than establishing that the CSS layouts themselves failed. Home Kiosk 0.3
adds a private diagnostic of same-origin hashed asset status and MIME type;
results are pending. It collects no page contents or authentication values.

The device report subsequently confirmed that credentialed XHR receives the
current JS and CSS with HTTP 200 and correct MIME types, but the linked CSS is
inaccessible, the stage remains `display:block; position:static`, and App is
absent. Parsing the exact fetched bundle with `new Function` inside the running
iPad WebView succeeded (the bundle was not executed by that check).

Vite's anonymous asset tags were changed to explicit `crossorigin="use-credentials"`
for same-origin built scripts, stylesheet links and preloads, following
[Cloudflare's protected-resource guidance](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/).
External font/CDN tags are unchanged. Two focused regression tests and the build
pass. Deployed as `46987981-c213-4739-bf4a-14b592d1d916`. The subsequent device
report confirmed App present, 614 readable linked stylesheet rules, and stage
display grid / position absolute. This verifies the asset loading/activation
failure was corrected; complete visual layout confirmation is still pending.
No Access policy was weakened or changed.

## Viewport and document scrolling

The user then confirmed styling and partial functionality, but reported an
offset, scrollable canvas. The old layout explicitly centered a 1280×800 stage
and used a fixed-width mobile viewport. The page now uses device-width, anchors
the scaled stage at (0,0), fixes the document body, and expands the stage's
logical height for taller aspect ratios. The 1024×768 iPad therefore fills both
axes without cropping or a top/left letterbox. Uniform scaling and the 1280px
design width keep existing touch-coordinate calculations valid.

Home Kiosk 0.4 removes automatic native scroll insets and bounce. Once the
dashboard is detected, it resets and locks only the outer WKWebView scroll view;
authentication pages retain normal root scrolling. CSS overflow panels remain
enabled; individual widget scrolling still needs touch verification.

Built, tested across viewport sizes, deployed as
`b0d52012-acd8-4554-a988-5baa887613f8`, and installed with a rollback copy.
The user confirmed **top-left and fixed**. The actual device report verified
viewport 1024×768, stage bounds left 0 / top 0 / width 1024 / height 768,
and document scroll offsets 0 / 0. The current assets load and the bundle syntax
is accepted by the running iPad WebView.

After deployment, reload the configured
dashboard in Home Kiosk and inspect Today, Calendar, Chores, Shopping, Photos
and Agents. Verify only the selected view is visible, touch navigation works,
text fits, data/error labels are truthful, and photos render. Device rendering,
advanced controls in the unconnected Control view, long uptime and exact font
metrics remain unverified. Do not treat this first pass as completed device QA.
