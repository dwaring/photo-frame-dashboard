# Personal Home HQ

## Current state

Web dashboard prototype based on wesbos/photo-frame-dashboard at 033b5ac,
currently developed and tested on a Mac. The deployment target is an Android
tablet running independently in kiosk mode, without an always-on Mac or home
server. Android kiosk deployment is not yet verified.
Adelaide current weather uses BoM West Terrace / ngayirdapira station 94648
(023000). Open-Meteo supplies the separately labelled hourly/daily forecasts.
Google Calendar has a local read-only OAuth connection and shared-calendar picker;
it is not connected until a client is configured, consent granted, and a calendar selected.
Agents shows only ChatGPT. Live quota windows and token activity use Codex
app-server, with the actual plan returned by the account. A local read-only probe
succeeded and confirmed Plus, which the user confirmed is the correct plan.
The Cloudflare Container/Durable Object adapter is implemented and built.
A separate service sign-in succeeded and also reported Plus. Deployment is blocked
because Cloudflare requires the Workers Paid plan for Containers on this account;
credentials have not been uploaded. Default deployment now omits the optional
ChatGPT Container; use `npm run deploy:chatgpt` for its separate configuration
once account access is available. Hosted verification remains pending. See docs/chatgpt-usage.md.
Coverage of all ChatGPT conversations is not verified. No sample usage is shown.
Chores uses a separate Todoist project with 24 active templates at the final live verification, with duplicate definitions consolidated and intervening household edits preserved. Multiple person labels map one template to independent person lanes; day/timeslot labels define its schedule. Descriptions are ordinary notes with no dashboard metadata. Dated completion history is held privately in hosted R2; local development uses separate ignored history files. Existing completion records were preserved during the redesign on 2026-10-16. Authenticated hosted UI verification remains pending. Other channels still display upstream sample data and are not connected.
Initial channels: Google Calendar, Adelaide weather, shared shopping/groceries,
Spotify, Todoist, photos. Shopping uses a deployed Todoist adapter with Worker secrets configured. A read-only live adapter check returned 3 active items on 2026-10-16. Live adapter checks verified usuals, add, quantity, duplicate prevention, complete, and add-back actions with a temporary item, removed afterwards. Authenticated hosted browser rendering remains to be verified. No sample groceries are displayed.
GitHub owner: dwaring. Fork: https://github.com/dwaring/photo-frame-dashboard
Personal starting branch: personal-dashboard. Main tracks the upstream baseline.

## Deployment scope

The tablet must operate without the development machine. Internet access is
required for live shared-service sync; independent operation does not mean
fully offline operation. Prefer a hosted web dashboard with a small authenticated
hosted backend for service credentials, OAuth, and API routes. Cloudflare Workers
is the selected hosting direction, matching the existing Wrangler configuration.
Wrangler authentication is verified. The home-dashboard Worker now serves the
built dashboard and fixed weather API routes using dashboard/wrangler.jsonc.
Cloudflare Access redirects unauthenticated requests to sign-in. Authorized
browser rendering and live weather behavior still require user verification;
kiosk/browser setup is pending. Todoist is deployed and configured; hosted Google Calendar OAuth and event routes are implemented; hosted connection and verification are pending.

Current local Vite routes and Mac-side credential storage are development
infrastructure, not a completed Android deployment. Calendar OAuth still needs a deployment-compatible backend. The BoM and
Open-Meteo routes have been ported to the Worker; hosted upstream success
has not yet been verified through an authenticated session. Do not put service secrets in the
tablet's browser configuration or expose private data through public endpoints.
Plan cached display with last-synced/stale status; offline editing and conflict
handling are not implemented.

Todoist is the selected single source for groceries, recurring chores, and home
projects. Trello is being superseded; its existing home board must be retained
until migration is verified. The separate Trello groceries board was prepared
but never connected to the dashboard. Woolworths and Amazon are the shopping
stores. The Shopping project has been identified. A hosted Todoist API adapter supports read sync, add, complete, quantity, and add-back actions. A separate Shopping usuals project supplies reusable quick-add tiles; the original shopping layout and store/category controls are restored. Worker secrets are installed and a live read succeeded; live adapter mutations have also passed; authenticated hosted UI verification remains pending. Trello migration is not verified. See docs/todoist.md.
Apple Notes/Reminders via a Mac helper does not meet the independent-tablet
requirement.

## Local development

Use Node 22.12+ or a current supported LTS. In dashboard/ run `npm ci`, then
`npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`.
Open http://127.0.0.1:5173/. Run `npm run build` before committing changes.
Todoist also works locally using the ignored server-only `.private/todoist-token`
and `.private/todoist.json` files; local edits update the live Todoist projects.
See docs/todoist.md.

Copy dashboard/config/example.json to dashboard/config/local.json for local
display preferences. Keys in peopleNames are the existing demo person IDs
darren, nadine, harvey, frankie. Other channel entries record configuration intent only; enabled flags do not
yet connect those services. Weather is fixed to Adelaide (Australia/Adelaide),
refreshes every 10 minutes, and uses a browser cache with explicit stale/error
labels. No weather API key is required. Browser time uses the device timezone
(the Mac during development); verify the tablet's timezone during kiosk setup.

Never put passwords, OAuth secrets, tokens, or private calendar URLs in browser
config. Anything imported by Vite is delivered to the browser, even when ignored
by Git. Personal photos belong in ignored dashboard/public/personal/ for local
use; all public assets would be included by a future deployment.

## Implementation roadmap

1. Local OAuth callbacks and ignored server credential storage implemented for Google Calendar.
2. Google Calendar: read-only connection, calendar selection, timed/all-day events,
   recurring expansion, and sync/stale status implemented. Complete local Google setup
   using docs/google-calendar.md and verify against the household calendar.
3. Weather: BoM measured observations via fixed /api/weather/observations route
   in the local Vite dev/preview server; separately labelled Open-Meteo forecasts.
   The hosted Worker also implements these fixed routes. Restart the local server
   after changing Vite configuration. No model fallback for station observations.
4. Todoist: configure shared groceries, chores, and home projects; migrate and
   verify existing Trello tasks before retiring their source. Configure Worker secrets and verify the implemented hosted
   read sync and add/complete actions. Define store, quantity,
   notes, categories, and recurring-task mappings. Distinguish demo, configured,
   connected, and stale states.
5. Spotify: connect account and show playback; add playback controls only after
   account/device capabilities are confirmed.
6. Photos: hosted Google Photos Picker manual import implemented with private R2
   storage. Hosted Google OAuth, selection and import succeeded; user verified photos
   display. Import controls are available at /api/google-photos/setup.
   This is a snapshot import, not album sync. See docs/google-photos.md.
7. Configure Cloudflare Workers hosting and authentication; move required local backend functions to
   the hosted environment. Add persistent storage and backup/restore where
   needed. Verify Android kiosk startup after reboot, touch layout, session
   persistence, reconnect behavior, and cached display during outages.

## Upstream maintenance

Keep upstream pointing to wesbos/photo-frame-dashboard and origin to your fork.
Work on feature branches. Fetch upstream and review dashboard changes before
merging; device flashing scripts are outside this project's scope.

## Pending decisions

Calendar selections; Todoist projects and Trello migration; photo source; household names; whether
Spotify is for now-playing or playback control; shared shopping field
mapping; hosted authentication; Android kiosk/browser setup and offline policy.
Access-protected dashboard, weather, and Todoist routes are deployed; hosted calendar implementation is ready; Google callback configuration and account consent remain pending.
An always-on Mac/home server is not a deployment option.
