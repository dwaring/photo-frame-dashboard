# Google Photos manual imports

Hosted import connected and display verified. This imports a
snapshot of up to 100 selected photos; additions to an album do not sync.
Videos are skipped. A successful import replaces the previous selection.
The shared household selection appears on Home, Photos and ambient mode.

## Hosted setup

Use the Cloudflare Access-protected dashboard hostname. The entire hostname,
including `/api/*` and the OAuth callback, must be protected by Access. Restrict
the Access policy to household members: any authorized member can replace the
shared photo selection. Keep workers.dev and preview bypass URLs disabled.
The Worker requires Access assertion and authenticated email headers; this relies
on Cloudflare Access enforcing the policy before requests reach the Worker.

1. In Google Cloud Console, select your existing project or create a project.
   Enable **Google Photos Picker API**.
2. Configure Google Auth Platform consent (External for a personal Google account).
   Add your Google account as a test user while the app is in Testing. Add scope
   `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
3. Create an OAuth client of type **Web application**. Add this exact authorized
   redirect URI, substituting your protected hostname:
   `https://YOUR-DASHBOARD-HOST/api/google-photos/callback`.
4. Create private R2 storage from `dashboard/`:
   `npx wrangler r2 bucket create home-dashboard-photos`.
   R2 may require enabling billing. Do not enable public access or an R2 custom domain.
   The binding is already declared in `dashboard/wrangler.jsonc`.
5. Store the client values using interactive secret prompts from `dashboard/`:
   `npx wrangler secret put GOOGLE_PHOTOS_CLIENT_ID` and
   `npx wrangler secret put GOOGLE_PHOTOS_CLIENT_SECRET`.
   Do not put these in browser config, source files, or chat.
6. Build and deploy using `npm run deploy`. This deploys the dashboard and
   photo import with Worker + R2, without Docker or Containers. The optional
   ChatGPT usage Container is retained in `wrangler.chatgpt.jsonc` and can be
   deployed later using `npm run deploy:chatgpt` once Containers access is working.
   These are alternative configurations for the same Worker; the default
   deployment leaves hosted ChatGPT usage disconnected.
7. Open `https://YOUR-DASHBOARD-HOST/api/google-photos/setup`.
   Connect Google, choose photos (browse your album inside Google's picker),
   press Done, return to setup, and press **Import selection**. Keep the page
   open until completion. Return to the dashboard; refresh if needed.

Authorization is short lived (no refresh token requested). Reconnect for a later
import or if the selection expires. Google tokens and temporary URLs stay in
private R2 and are deleted after successful import. Photos are copied at up to
1600 × 1200 resolution; the dashboard does not retain Google original filenames
or invent family/location captions. Photo responses require dashboard sign-in.

A failed import leaves the previously published selection intact. Retry Import
selection while authorization is valid. Interrupted/restarted imports may leave
unreferenced private image objects. Delete unused objects via the R2 console;
do not delete images used by the current `manifest`. Expired `auth/` and `oauth/`
objects can also be removed. To remove all imported data, delete the bucket's
objects and revoke the app in your Google account's third-party connections.

## Local display

From `dashboard/`, run `npm run photos:sync-local` after changing the hosted
selection. This downloads the imported selection from private R2 using your
Wrangler account into ignored `.private/photos/`. The manifest is published
locally only after all images download. Restart with `Start Dashboard.command`
if the local server was already running when this feature was installed.
Home, Photos and ambient mode use these local copies. No photos are bundled
into builds. An empty selection displays “No photos imported”. Other unconnected
image surfaces use a neutral “Not connected” placeholder.

OAuth/import remains hosted; the Android tablet uses private hosted photos and
does not depend on this local copy or the Mac.

References: https://developers.google.com/photos/picker/guides/get-started-picker
and https://developers.google.com/photos/picker/guides/media-items
