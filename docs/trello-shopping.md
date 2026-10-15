# Shared groceries with Trello

## Superseded

Todoist was subsequently selected as the single source for shopping, chores,
and home projects. This document records the earlier Trello setup only; do not
build a new Trello runtime integration. Retain existing boards until migration
is verified.

## Earlier status

Trello was the initial source choice. A separate private Groceries board has been created
with a Shopping list and Woolworths and Amazon cards. Each store card has eight
empty checklists: Produce, Bakery, Meat & Fish, Dairy & Eggs, Pantry, Frozen,
Snacks, and Household. No demo groceries have been copied to Trello.

The dashboard still uses in-memory demo shopping data. The Trello connector in
Codex can manage the board, but its credentials are not a dashboard runtime
connection. Hosted sync, dashboard writes, and offline handling are not implemented.
Personal board links and identifiers should stay in ignored server configuration.

## Start using the shared source

1. Open the Groceries board in Trello and use Share to invite household members.
   Keep the board private. Each person uses their own Trello account.
2. Open the appropriate store card and add an item to a category checklist.
3. Put quantities and notes in the item text, for example `Milk — 2 L` or
   `Bananas — 1 bunch, slightly green`.
4. Tick an item after purchase. Untick it to put it back on the shopping list.
   Keep the store cards open; completing a shopping trip means checking the
   items, rather than archiving the store card.

Store cards and categories can be renamed before the runtime mapping is configured.

## Dashboard connection to implement

Use an authenticated hosted backend so the Android tablet needs no Mac or home
server. The repository currently has Cloudflare static-assets configuration
in dashboard/wrangler.jsonc, but no Trello backend or production authentication.
Cloudflare Workers is the selected hosting direction. Use a same-origin backend
with authenticated access; hosting is not deployed and runtime authorization
is still required.

- Store the Trello authorization token in server secrets. Never include it in
  Vite variables, browser config, source control, or client-side request URLs.
- Configure the selected board, Shopping list, and store card IDs server-side.
  Restrict API operations to these configured resources; do not provide an
  arbitrary Trello proxy.
- Authenticate the tablet/user before returning private shopping data or
  accepting writes. Add origin/CSRF protection for cookie-authenticated writes.
- Read checklist items and map store card to store, checklist to category,
  item name to display text, and check-item state to purchased state.
  Keep Trello IDs to address updates reliably.
- Initially preserve quantity/note text as entered; do not silently infer
  structured quantity fields from arbitrary names.
- Add and complete items through the backend, then reconcile with Trello.
  Show write failures and prevent demo-only actions from appearing successful
  on connected lists.
- Refresh with rate-limit backoff. Cache the last successful list with an
  explicit last-synced/stale indicator. Offline writes need a separate queue
  and conflict policy; do not report them as synced.

Authorize the dashboard separately using Trello's supported flow after choosing
hosting and authentication. Do not paste account passwords or authorization
tokens into chat. See [Trello authorization](https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/)
and [checklist API](https://developer.atlassian.com/cloud/trello/rest/api-group-checklists/).

## Verification before calling it connected

Verify phone-to-dashboard reads, dashboard-to-phone add/complete/restore,
empty lists, expired authorization, network failures, unauthorized requests,
and access attempts outside configured store cards. Confirm the Android kiosk
can retain its authenticated session and reconnect after restart.
