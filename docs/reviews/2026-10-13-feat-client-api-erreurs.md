# Review, feat/client-api-erreurs, 2026-10-13

**Reviewed by**: Sonnet 5.5 (author on same family, fresh context)
**Scope**: 34 files (package-lock excluded), branch vs main
**Verdict**: Approve with nits

## Summary
Adds the hand-written fetch client (token, single shared refresh, Zod validation, timeouts, typed errors), the session store with cross-tab BroadcastChannel sync, French error messages and display helpers. The design follows spec 0002 closely, the refresh and session-end paths are carefully ordered, and `vitest run` (69 tests) and `tsc -b` pass. No blocker or major found; the issues are edge cases around `login()` during an in-flight restore, a misleading 403 message, and unbounded backend text in "Details".

## Minor
### 🟡 `login()` does not abort the previous session controller or clear state, `src/shared/session/session.ts:154`
**Problem**: `login` replaces `session.controller` with a new one without aborting the old one, and does not clear the query cache. If login runs while a restore refresh is in flight (status `restoring`), `refreshAccessToken` checks `signal.aborted` on the old, never-aborted signal, so it still calls `setAccessToken` with the token of the restored refresh token after login stored its own. The access token can then belong to a different account than `user`/refresh token. Likewise, `login()` while already `authenticated` (other account) keeps the previous account's cached data.
**Why it matters**: Cross-account token/data mixing, low probability (feature 5 is meant to show a loader during `restoring`, but a Render cold start can last about 70 s), high impact when it happens.
**Suggested fix**: In `login`, run the same cleanup as a session end (abort the old controller, drop `refreshPromise`, clear tokens and the query cache) before storing the new tokens.

### 🟡 Authenticated 403 with a `code` shows the "not admin" message, `src/shared/api/messages.ts:30`
**Problem**: `STATUS_MESSAGES[403]` is "Ce compte n'a pas accès au tableau de bord." and is used for every `http` 403. The spec table only assigns it to a 403 at login. A mid-session `403 PREMIUM_REQUIRED` (the example in AC-5) therefore tells the admin they have no dashboard access, and `messages.test.ts:17` locks this in.
**Why it matters**: Misleading message on a case the spec explicitly keeps as an ordinary error.
**Suggested fix**: Only map 403 to that text when the call was a login (or let `login` pass an override), and fall back to the generic message otherwise.

### 🟡 Non-JSON backend body is kept whole and shown in "Details", `src/shared/api/client.ts:152`
**Problem**: For an HTML 502/503 page, `backendMessage` is the full HTML text, rendered in a `Code block` (`ErrorDetails.tsx`), with no size cap. It also stays in `error.body`.
**Why it matters**: Huge or unreadable details panel; slightly larger surface for echoing unexpected content. Render's wake-up pages are the common case.
**Suggested fix**: Truncate text bodies (for example a few hundred characters) or skip the detail for HTML.

### 🟡 Refresh token only lives in sessionStorage, so the "memory only" fallback does not work, `src/shared/session/store.ts:72`
**Problem**: `writeRefreshToken` swallows storage failures with a comment saying the session then lives in memory, but `refreshAccessToken` and the tab share read only from `sessionStorage`. The first 401 then ends the session as `expired`.
**Why it matters**: Silent, confusing logout when storage is blocked; the comment is wrong.
**Suggested fix**: Keep an in-memory copy of the refresh token as fallback, or fix the comment and surface the failure.

### 🟡 Refresh failure other than 401 or session-ended is rethrown as is, `src/shared/api/client.ts:219`
**Problem**: A `400`/`403` http error from `/auth/refresh` (non-401) propagates to the caller as a normal `http` error and its message ("Certaines informations sont invalides.") is meaningless for the original request. Also, when the refresh is cancelled by a logout (`session-ended` reason `logout`), `isRefreshRefused` converts it to reason `expired`.
**Why it matters**: Wrong message in rare edge cases; no data impact.
**Suggested fix**: Treat any 4xx from refresh as refused, and keep the original reason when the error already is `session-ended`.

### 🟡 Test gaps on the riskiest paths
**Problem**: No tests for: logout/`logout` message received during `restoring` (cancel path, `session.ts:91`), login during restore, a second 401 after replay, refresh failing with network error (session kept, error rethrown), in-flight requests aborted at session end, `restoreSession` idempotence, `applyFieldErrors`/`shouldRetryQuery` edge cases beyond the happy paths listed.
**Why it matters**: These are exactly the race-prone branches; the finding above on `login()` would have been caught.
**Suggested fix**: Add focused tests for these cases.

## Nits
- ⚪ `src/shared/session/session.ts:232`, `resetSessionForTests` is exported from production code; acceptable but could live behind a test-only entry.
- ⚪ `src/shared/session/session.ts:176`, `restoreCancelled` is never reset; harmless today because restore runs once, worth a comment.
- ⚪ `src/shared/api/messages.ts:37`, the 429 text is specific to image uploads but applies to every 429 (for example login throttling); spec-conformant, revisit with feature 5.
- ⚪ `src/shared/api/client.ts:77-84`, `body instanceof FormData` is tested twice in `buildInit`.
- ⚪ `src/shared/session/session.ts:213`, a transient network error or timeout at restore clears the refresh token (as AC-7 says), which logs the admin out after a Render cold-start timeout; consider keeping the token on network/timeout in a later iteration (spec change).

## Strengths
- Refresh sharing is correct: promise shared, released only if still current, session-signal check prevents resurrecting a token after logout, and the "token already replaced, replay directly" rule is handled.
- Session end ordering follows the spec (clear tokens, abort, clear cache, set state, broadcast) and the first reason wins; `logout` from another tab is not rebroadcast.
- Token hygiene is good: invalid-response logs only path and code, `ApiError.message` never contains data, unknown errors never expose `error.message`, no localStorage, no tokens in URLs.
- Per-attempt timeout with manual abort linking handles caller/session/timeout distinctly, and listeners and timers are always cleaned in `finally`.
- Cross-tab messages are validated with Zod before use, and the first `share` wins.

## Test coverage
Configured (Vitest + MSW). 69 tests pass and typecheck is clean. Good coverage of AC-3/4/5/6/7/8/9/11/14, messages table, retry rule and UI helpers. Gaps are listed in the last Minor finding (restore cancel path, login/restore race, double 401, non-401 refresh failures, abort on session end).
