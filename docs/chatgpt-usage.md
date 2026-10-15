# ChatGPT account usage

The Agents widget reads live account statistics through Codex app-server's
`account/rateLimits/read` and `account/usage/read`. It makes no model requests.
The returned quota bucket is normally Codex; coverage of all ChatGPT conversations
is not verified. Token activity is not API billing or subscription cost.
Missing metrics remain unavailable, never zero. The plan comes from the connected
account rather than a display preference.

Official protocol: https://learn.chatgpt.com/docs/app-server

## Architecture

The Access-protected dashboard Worker calls a single named Durable Object via an
internal binding. The object starts a Cloudflare Container running a pinned Codex
CLI and a small Node service. The container has no public route. Only the usage
reader's three account RPC methods are invoked; arbitrary RPC, conversations,
model execution and account management are not exposed.

The initial authorization is supplied as the Worker secret `CODEX_AUTH_JSON`.
The object stores refreshed auth in its SQLite storage after each successful
read, then returns only sanitized statistics. Credentials, account email and
account IDs do not reach browser configuration, responses or build assets.
A changed initial secret resets the stored account and clears cached stats.
Keep the whole Worker behind Cloudflare Access; `/api/chatgpt/usage` additionally
requires the Access assertion header. Container service authentication is generated
inside the object and never shared with the browser.

Usage is cached for two minutes and refreshed while the Agents view is active.
The container sleeps after one minute of inactivity; the tablet needs no Mac.
The widget keeps its last successful result in memory during a failure and marks
it stale. It does not persist private usage in browser storage. Local development
uses the signed-in local Codex CLI directly and has its own two-minute cache.

## Initial setup

1. Build with `npm run build` in `dashboard/` and validate with
   `wrangler deploy --dry-run`. Docker with buildx is required for image builds.
2. Sign in using an isolated, ignored directory, keeping the developer's existing
   Codex session separate:

   ```sh
   CODEX_HOME="$PWD/.private/chatgpt-hosted" codex login --device-auth
   ```

   Run from the repository root. Complete sign-in in your browser with the intended
   account. Device sign-in must be enabled in the account's security settings.
   Never paste the auth file or tokens into chat.
3. From `dashboard/`, upload that auth file directly as a secret without printing it:

   ```sh
   npx wrangler secret put CODEX_AUTH_JSON < ../.private/chatgpt-hosted/auth.json
   ```

4. Deploy with `npm run deploy`. The deployment creates a Container application
   and a SQLite Durable Object. Cloudflare Containers availability and billing
   depend on the account's Cloudflare plan. Existing Access protection must remain.
5. Open the hosted dashboard's `#agents` view and verify the returned account plan,
   quota bucket and last-sync time. A successful local probe is not verification
   of the hosted deployment.

To change accounts, use a fresh isolated login and replace `CODEX_AUTH_JSON`.
To disconnect, delete that secret and revoke the hosted session in your OpenAI
account. A missing secret immediately prevents usage reads; retained object
credentials require an explicit storage cleanup if the service is retired.

## Validation

Run `node --test usage-service/*.test.js` from `dashboard/`.
Tests verify credential filtering, unavailable metrics, and safe startup failures.
The live probe on the development Mac returned quota and daily activity data;
it reported Plus, so the intended Pro account still needs a separate hosted login.

## Current deployment status

Dashboard build, container build and Worker dry-run succeeded. A separate service
sign-in succeeded and returned live quotas and seven daily activity buckets;
OpenAI reported its plan as Plus. Credentials remain in the ignored
`.private/chatgpt-hosted/` directory and have not been uploaded.

Cloudflare rejected the deployment before Worker upload with HTTP 401:
“Deploying containers requires the Workers Paid plan.” Enable the appropriate
plan at https://dash.cloudflare.com/?to=/:account/workers/plans before retrying.
The existing hosted dashboard has not been updated by this attempt.
