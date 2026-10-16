# Todoist shopping

Shopping uses the Todoist Shopping project as its durable source. Sample groceries
have been removed, including the home-screen preview. Other dashboard channels
may still contain demo data. The Todoist chat connector confirmed the Shopping
project exists; it does not authorize the hosted Worker.

## Hosted setup

1. In Todoist Settings → Integrations → Developer, copy the API token.
2. From `dashboard/`, run `npx wrangler secret put TODOIST_API_TOKEN` and paste
   the token into the hidden prompt. Never add it to browser config or a commit.
3. Run `npx wrangler secret put TODOIST_PROJECT_ID` and enter the Shopping project
   ID from its Todoist URL. This is server configuration, not a browser setting.
4. Run `npm run deploy` (or the separately configured `deploy:chatgpt` if in use).
5. Sign in through Cloudflare Access, open Shopping, and verify the items against
   Todoist. Add a deliberate test item and complete it, checking both apps.

Access must protect the entire Worker hostname. Routes reject requests without
an Access assertion and reject mutations from another origin. Completing a task
also checks it belongs to the configured project. Tokens are held in Worker
secrets and are never returned to the browser.

## Usuals and shopping controls

The separate **Shopping usuals** Todoist project supplies the dashboard's quick-add
choices. Add, rename, reorder, or remove its tasks in Todoist to change the tiles.
Keep them active: checking a usual item off in Todoist removes its tile on the next
refresh. `TODOIST_STAPLES_PROJECT_ID` is the existing Worker secret for this project;
its internal name is retained for compatibility. The old static `DATA.usuals`
demo list is now populated from Todoist after sync.

Tapping a tile copies its title, notes, and labels into Shopping without completing
or changing the usual item. An item already present in that store shows “On list”;
use its quantity buttons to buy more. Repeated add requests check for an existing
item first. Simultaneous requests from different devices can still race.

The shopping screen retains the original two-column layout, category grouping,
store filters, quantity buttons, suggestions from your usuals, and quick add.
Quantities use a trailing ` ×2` in the Todoist task title (1–999); other title text
and descriptions are preserved. The `amazon` label selects Amazon; otherwise
items default to Woolworths. Adding with a store filter applies that store.
With All selected, a usual item keeps its own store. Category groups are inferred
from the built-in grocery vocabulary; unmatched items appear under Other.

Checking an item gives five seconds to Undo before saving completion to Todoist.
The item can also be tapped again during that interval to cancel. Regular items
completed here remain in a session-only “Got it” drawer with Add back. Clearing
that drawer only clears the local history; it does not delete Todoist tasks.
Recurring tasks advance according to Todoist rules and are excluded from the
Add back drawer to avoid changing their next due date.

Active tasks and usuals refresh every minute and on demand. Mutations reload
the list after success. Titles and descriptions display as plain text. Manage
sections, subtasks, notes, and store labels in Todoist; the dashboard shows a flat
list, grouped into inferred grocery categories. Organizational headers cannot
be completed or have their quantities changed.

Last-sync status and retained in-memory items are labelled stale after failures.
There is no persistent offline cache or offline editing. An unconfigured source
shows a connection message. Local Vite dev and preview servers also provide the Todoist route on localhost.
The deployed dashboard remains independent of the Mac.

Validation: `node --test worker/todoist.test.js` and `npm run build` from dashboard.
Worker secrets were installed and the integration deployed on 2026-10-16. A read-only check using the same adapter and token returned 3 active shopping items. The hosted endpoint redirects unauthenticated requests to Cloudflare Access. Live adapter checks also verified four usuals, adding, quantities, duplicate prevention, completing, and reopening with a temporary item that was removed afterwards. Authenticated hosted browser display still needs user verification.
API reference: https://developer.todoist.com/api/v1/

## Local development

The localhost dev/preview server reads the token from `.private/todoist-token`
and project selections from `.private/todoist.json` at the repository root:

```json
{
  "shoppingProjectId": "YOUR_SHOPPING_PROJECT_ID",
  "usualsProjectId": "YOUR_SHOPPING_USUALS_PROJECT_ID"
}
```

Both files are ignored by Git and blocked from Vite asset serving. These are
server-only files; never put the token in `dashboard/config/`. Local actions
update the same live Todoist projects as the hosted dashboard. Credentials are
read for each request, so changing them does not require a restart.

Start using the standalone launcher or run `npm run dev -- --host 127.0.0.1
--port 5173 --strictPort` from `dashboard/`, then open
http://127.0.0.1:5173/#shopping. Restart Vite once after adding this plugin.
The route requires a loopback peer and localhost Host header. Cross-origin
requests are rejected, and writes require a matching Origin header.
