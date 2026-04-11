# Calendly OAuth — scope

## Goal

Replace manual link-pasting + manual webhook setup with a one-click **Connect Calendly** flow. When a user connects, Clinchd auto-registers their webhook and lets them pick an event type from a dropdown. No env-var juggling, no dashboard spelunking.

## Prerequisites

1. **Calendly OAuth app** already exists — confirm redirect URI is set to `https://clinchd.io/api/auth/calendly/callback` (and a local one if using ngrok).
2. **Env vars** — `CALENDLY_CLIENT_ID`, `CALENDLY_CLIENT_SECRET`. `CALENDLY_WEBHOOK_SIGNING_KEY` is **no longer shared** — signing keys are now per-user and stored in the DB.
3. **Calendly plan limitation** — webhook subscriptions require the *user's* account to be on Standard+. Free users will get a clear error. No workaround.

## DB migration (`007_calendly_oauth.sql`)

Add to `users`:

```sql
calendly_access_token        TEXT,
calendly_refresh_token       TEXT,
calendly_token_expires_at    TIMESTAMPTZ,
calendly_user_uri            TEXT,   -- https://api.calendly.com/users/UUID
calendly_organization_uri    TEXT,   -- needed for webhook scope
calendly_webhook_uri         TEXT,   -- the subscription we created, so we can delete it on disconnect
calendly_webhook_signing_key TEXT,   -- per-user HMAC secret returned by Calendly
calendly_event_type_uri      TEXT,   -- the picked event type
calendly_event_type_name     TEXT
```

`calendly_url` stays (as the public scheduling link we drop in DMs), but it's now populated from the event-type API response instead of hand-pasted.

## Files to build

### `src/lib/calendly.js` — thin API client

- `getAuthorizeUrl(state)` → Calendly OAuth URL with `response_type=code` and `redirect_uri`
- `exchangeCodeForToken(code)` → POST `/oauth/token`, returns access/refresh/expires
- `refreshAccessToken(refreshToken)` → same endpoint with `grant_type=refresh_token`
- `getCurrentUser(accessToken)` → GET `/users/me`, returns `{uri, current_organization, scheduling_url}`
- `listEventTypes(accessToken, userUri)` → GET `/event_types?user={userUri}&active=true`
- `createWebhookSubscription(accessToken, {organizationUri, userUri})` → POST `/webhook_subscriptions` with `url`, `events: ["invitee.created","invitee.canceled"]`, `scope: "user"` → returns `{uri, signing_key}`
- `deleteWebhookSubscription(accessToken, webhookUri)` → DELETE
- `withFreshToken(user, fn)` helper — transparently refreshes if `expires_at < now + 60s` and updates the row

### `src/app/api/auth/calendly/route.js` — kicks off OAuth

- Generates `state` (signed JWT or Supabase-session-backed) so the callback knows which user
- Redirects to `getAuthorizeUrl(state)`

### `src/app/api/auth/calendly/callback/route.js` — the bulk of the work

1. Verify `state`, get the authed Supabase user
2. Exchange `code` → tokens
3. Fetch `/users/me` → store `calendly_user_uri`, `calendly_organization_uri`
4. Call `createWebhookSubscription` — on failure, surface a clear error ("Calendly webhook subscriptions require a paid plan") and still store the tokens so they can at least pick an event type
5. Store tokens + webhook URI + signing key in `users`
6. Redirect to `/settings?calendly=connected` (or `/onboarding` if in that flow)

### `src/app/api/calendly/event-types/route.js` — GET endpoint for the picker

- Uses `withFreshToken` to call `listEventTypes`
- Returns `[{uri, name, scheduling_url, duration, active}]`

### `src/app/api/calendly/select-event-type/route.js` — POST to save the user's pick

- Body: `{eventTypeUri}`
- Looks up the event type, saves `calendly_event_type_uri`, `calendly_event_type_name`, and mirrors `scheduling_url` into `calendly_url` (so existing DM-reply code keeps working unchanged)

### `src/app/api/auth/calendly/disconnect/route.js` — POST

- Calls `deleteWebhookSubscription` (best-effort, don't block on failure)
- Nulls out all `calendly_*` columns
- Leaves any existing `bookings` rows alone

### `src/app/api/webhooks/calendly/route.js` — update existing file

- Replace the shared `CALENDLY_WEBHOOK_SECRET` env-var check with a per-user signing key lookup: parse the payload, find the user via `calendly_user_uri` (already in the payload under `created_by` or `event_memberships`), then verify the signature against *that user's* `calendly_webhook_signing_key`. Reject if no match.
- Rest of the handler (upserting bookings, linking conversations) stays the same.

### `src/app/(dashboard)/settings/page.js` — replace the manual URL input

- "Connect Calendly" button when not connected → hits `/api/auth/calendly`
- When connected: show connected email/handle, show an event-type `<Select>` populated from `/api/calendly/event-types`, show the active public link, show a **Disconnect** button
- Keep the manual URL field hidden behind an "Advanced" toggle for now — useful escape hatch if OAuth breaks

### `src/app/(onboarding)/onboarding/components/Step2Script.jsx`

Same Connect Calendly button, same event-type picker. Replaces the text input.

## Edge cases to flag up front

- **Token refresh races** — two requests hitting `withFreshToken` simultaneously will both try to refresh. Fine for now; fix with a row-level advisory lock later if it matters.
- **Free-tier users** — webhook creation returns a specific error; surface it cleanly ("Your Calendly plan doesn't support webhooks — upgrade, or use the Advanced manual link field").
- **User reconnects a different Calendly account** — must delete the old webhook first, or you'll leak subscriptions.
- **Clinchd user deletes their account** — `/api/user/delete` needs to also delete the webhook subscription. Add this to the existing delete flow.
- **Webhook signature per-user verification** — current code assumes one shared secret. Changing to per-user means the "find the user" step has to happen *before* signature verification, which inverts the normal order. The lookup has to be on a field Calendly puts in the payload unauthenticated (user URI), and then you verify. This is safe because a forged payload pointing at a real user URI will still fail HMAC.
- **Event type changes** — if the user deletes the event type in Calendly, our stored `calendly_event_type_uri` becomes stale. Either re-fetch on every settings load, or handle 404 gracefully.

## Rough effort

- DB migration + `lib/calendly.js`: 1h
- OAuth routes (authorize, callback, disconnect): 2h
- Event-type picker routes + settings UI: 2h
- Webhook handler refactor to per-user secrets: 1h
- Onboarding Step 2 update: 30min
- Testing end-to-end with a paid Calendly account: 1h+

Call it **half a day to a full day** depending on how much friction the Calendly API throws.

## What to cut from v1

- Event-type picker — just pull `scheduling_url` from `/users/me` and use their default booking page. Saves the event-types endpoints and a UI component. Add the picker in v2 once the core flow is solid.
- Onboarding integration — ship it in settings first, backfill onboarding after.

## Open questions before starting

1. Sanity-check the existing Calendly app config: redirect URI, scopes (`default` is usually enough), and whether it's a personal or organization app.
2. Decide v1 scope: full picker or just default scheduling URL?
3. Confirm we want to keep the manual URL field as an "Advanced" escape hatch, or remove it entirely once OAuth is live.
