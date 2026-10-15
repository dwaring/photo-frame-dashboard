# Personal Home HQ

## Current state

Mac browser prototype based on wesbos/photo-frame-dashboard at 033b5ac.
The UI still displays upstream sample data. No personal service is connected yet.
Initial channels: Google Calendar, Adelaide weather, Spotify, Trello, photos.
GitHub owner: dwaring. Fork: https://github.com/dwaring/photo-frame-dashboard
Personal starting branch: personal-dashboard. Main tracks the upstream baseline.

## Local development

Use Node 22.12+ or a current supported LTS. In dashboard/ run `npm ci`, then
`npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`.
Open http://127.0.0.1:5173/. Run `npm run build` before committing changes.

Copy dashboard/config/example.json to dashboard/config/local.json for local
display preferences. Keys in peopleNames are the existing demo person IDs
alex, jordan, maya, otto. Channel entries record configuration intent only;
enabled flags do not yet connect services. Browser time uses the Mac timezone.

Never put passwords, OAuth secrets, tokens, or private calendar URLs in browser
config. Anything imported by Vite is delivered to the browser, even when ignored
by Git. Personal photos belong in ignored dashboard/public/personal/ for local
use; all public assets would be included by a future deployment.

## Implementation roadmap

1. Add a local backend with OAuth callbacks and an ignored credential store.
2. Google Calendar: choose calendars, read-only OAuth, normalize timed/all-day
   events and timezones, show sync status and stale-data state.
3. Weather: Adelaide, Australia/Adelaide; implement current/hourly forecast with
   caching and explicit failure state. Replace demo weather only after validation.
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
