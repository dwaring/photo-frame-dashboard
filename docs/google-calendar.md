# Shared Google Calendar

This integration reads one selected Google calendar. It never writes Google events.
Until a calendar is selected, the dashboard calendar is empty.

## Hosted setup

The hosted Worker supports one read-only household calendar without the Mac.
Visit `/api/google-calendar/setup` on your Cloudflare Access-protected dashboard.
No date picker is required; the existing Calendar navigation stays in place.

1. Enable Google Calendar API in the Google Cloud project used for Photos.
2. Add these read-only scopes to Google Auth Platform data access:
   `https://www.googleapis.com/auth/calendar.calendarlist.readonly` and
   `https://www.googleapis.com/auth/calendar.events.readonly`.
3. On the existing Photos web OAuth client, add the exact redirect URI
   `https://YOUR-DASHBOARD-HOST/api/google-calendar/callback`.
   Calendar reuses the hosted Photos client secrets by default. For a separate
   client, set both `GOOGLE_CALENDAR_CLIENT_ID` and
   `GOOGLE_CALENDAR_CLIENT_SECRET` with Wrangler interactive secret prompts.
4. Deploy from `dashboard/` using `npm run deploy`.
5. Open `/api/google-calendar/setup`, connect Google, grant read-only access,
   and select the shared calendar. Return to the dashboard to sync.

The entire hostname and callbacks must be protected by Cloudflare Access,
with workers.dev and preview bypass URLs disabled. Any authorized household
member can replace the shared connection. Tokens and selection remain under
`calendar/` in the existing private PHOTOS R2 bucket; they never enter browser
configuration. Photos imports are separate and do not delete Calendar records.
A successful reconnection clears the selected calendar until you choose again.
Google accounts in Testing may require reauthorization after seven days.
Hosted sign-in, calendar selection and live rendering still require verification.
To disconnect, delete `calendar/connection` from private R2 and revoke the
Calendar app authorization in Google. Expired `calendar/oauth/` records can
be deleted from R2.

## Local Google setup

1. In https://console.cloud.google.com/ create or choose a project and enable **Google Calendar API**.
2. Configure **Google Auth Platform** branding and audience. For an external app in Testing, add the Google account with access to your shared calendar as a test user.
3. Under **Clients**, create an OAuth client of type **Web application**.
4. Add this exact authorized redirect URI:
   `http://127.0.0.1:5173/api/google-calendar/callback`
5. Download the OAuth client JSON. Create `.private/google-calendar/` in the project root and save the file there as `client.json`. This folder is ignored by Git, outside the browser app root, and blocked by the development file server. Never put this JSON in `dashboard/config`, `public`, or chat.
6. Restart the dashboard using `Start Dashboard.command`, then open http://127.0.0.1:5173/api/google-calendar/setup yourself.
7. Connect the account, grant the two read-only permissions, and choose the shared calendar from the list. The account must already have access to that calendar in Google Calendar.
8. Return to the dashboard. Calendar events load automatically. Revisit the setup URL to change calendar selection.

The client, refresh token, and selected calendar ID remain in `.private/google-calendar/` on this Mac. Protect this folder like a password. To disconnect, stop the dashboard and remove `tokens.json` and `selection.json` from that folder, then revoke the app in your Google account's connections if desired.

Testing-mode Google OAuth refresh tokens for these scopes can expire after seven days; reconnect when required. For continued use, review Google's publishing requirements for your account/project.

## Local connection verification

On 17 October 2026, the local integration successfully synced 255 events and
renewed its access token using the saved refresh token. The existing server
refreshes access tokens automatically before expiry; reconnecting is only needed
if Google expires or revokes authorization. Credentials and selection remain in
ignored server-only storage.

## Behavior and limits

- The selected shared calendar supplies calendar events throughout the dashboard; no sample calendar events are included.
- Titles mentioning Darren, Nadine, Harvey, or Frankie are assigned to those people (case-insensitive, whole names, including possessives). Multiple names assign multiple people. Titles without a matching name are assigned to everyone. Event titles are displayed unchanged; Google events are never edited.
- Examples: `Harvey — Soccer` → Harvey; `Darren + Nadine — Dinner` → both adults; `Family lunch` → everyone. Assignment applies to timed and all-day events, and the home screen shows today’s all-day events (including ongoing multi-day events) before remaining timed events.
- Timed events use the Mac timezone. All-day dates preserve their calendar dates and exclusive end date.
- Recurring events are expanded by Google; cancelled events are omitted and paginated results are loaded.
- The loaded window is one year before through one year after the current date. Navigation outside that window will show no events.
- Refresh runs every five minutes and on window focus. Last successful events remain visible with a stale label if refresh fails. No real event cache is written to browser storage.
- The local server is required, including for preview. Static hosting alone cannot connect Google Calendar. Use the localhost launcher at port 5173 for the registered callback URI.

References: https://developers.google.com/identity/protocols/oauth2/web-server and https://developers.google.com/workspace/calendar/api/auth
