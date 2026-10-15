# Personal Home HQ

## Current state

Mac browser prototype based on wesbos/photo-frame-dashboard at 033b5ac.
Adelaide current weather uses BoM West Terrace / ngayirdapira station 94648
(023000). Open-Meteo supplies the separately labelled hourly/daily forecasts.
Google Calendar has a local read-only OAuth connection and shared-calendar picker;
it is not connected until a client is configured, consent granted, and a calendar selected.
Other channels still display upstream sample data and are not connected.
Initial channels: Google Calendar, Adelaide weather, Spotify, Trello, photos.
GitHub owner: dwaring. Fork: https://github.com/dwaring/photo-frame-dashboard
Personal starting branch: personal-dashboard. Main tracks the upstream baseline.

## Local development

Use Node 22.12+ or a current supported LTS. In dashboard/ run `npm ci`, then
`npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`.
Open http://127.0.0.1:5173/. Run `npm run build` before committing changes.

Copy dashboard/config/example.json to dashboard/config/local.json for local
display preferences. Keys in peopleNames are the existing demo person IDs
darren, nadine, harvey, frankie. Other channel entries record configuration intent only; enabled flags do not
yet connect those services. Weather is fixed to Adelaide (Australia/Adelaide),
refreshes every 10 minutes, and uses a browser cache with explicit stale/error
labels. No weather API key is required. Browser time uses the Mac timezone.

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
   Static-only hosting does not provide the BoM route. Restart the local server
   after changing Vite configuration. No model fallback for station observations.
4. Trello: select boards/lists and import cards read-only first; agree on mapping
   to chores and shopping before enabling writes.
5. Spotify: connect account and show playback; add playback controls only after
   account/device capabilities are confirmed.
6. Photos: choose local folder or cloud album source, then add indexing and
   original-photo rendering in place of seeded demo images.
7. Add persistent storage for dashboard edits and backup/restore. Verify launch
   after reboot. Decide hosting/authentication before exposing personal data.

## Upstream maintenance

Keep upstream pointing to wesbos/photo-frame-dashboard and origin to your fork.
Work on feature branches. Fetch upstream and review dashboard changes before
merging; device flashing scripts are outside this project's scope.

## Pending decisions

Calendar selections; Trello boards/lists; photo source; household names; whether
Spotify is for now-playing or playback control. No production hosting yet.
