# Password Reset — Design Spec

**Date:** 2026-05-29
**Status:** Approved

---

## Overview

Add a complete password reset flow to the HOA board portal. Supports two entry points: a "Forgot password?" inline toggle on the login card, and a reset link sent manually from the Supabase dashboard. Both converge on the same `/auth/callback` → `/update-password` → `/login` path.

---

## User Flows

### Forgot Password (self-service)

1. User clicks "Forgot password?" on the login card.
2. The card swaps inline to an email input form (no navigation).
3. User submits their email → `requestPasswordReset` server action calls `supabase.auth.resetPasswordForEmail()` with `redirectTo: <origin>/auth/callback`.
4. Card shows a static "Check your email" confirmation. No further action required on this page.
5. User clicks the link in their email → continues at the Reset Link flow below.

### Reset Link (email → new password)

1. User clicks the link in the Supabase reset email.
2. Supabase redirects to `/auth/callback?token_hash=<hash>&type=recovery`.
3. Route handler calls `supabase.auth.verifyOtp({ token_hash, type })`:
   - **Success** → redirect to `/update-password` (session is now set in cookies).
   - **Failure** (expired/invalid token) → redirect to `/login?error=Link+expired+or+invalid.+Please+request+a+new+one.`
4. `/update-password` page renders a centered card with New Password and Confirm Password fields.
5. User submits → `updatePassword` server action:
   - Calls `supabase.auth.updateUser({ password })`.
   - Calls `supabase.auth.signOut()` to invalidate the recovery session.
   - Redirects to `/login?message=Password+updated.+Sign+in+with+your+new+password.`
6. Login page shows a success banner above the sign-in form.

---

## Architecture

### New Files

| File | Purpose |
|---|---|
| `app/auth/callback/route.ts` | Route handler — exchanges `token_hash` for a session, redirects |
| `app/(auth)/update-password/page.tsx` | Server component shell — centered card layout, reads no params |
| `app/(auth)/update-password/UpdatePasswordForm.tsx` | Client component — zod-validated form, calls `updatePassword` action |

### Modified Files

| File | Change |
|---|---|
| `app/(auth)/login/LoginForm.tsx` | Add inline "Forgot password?" toggle; read `?message` and `?error` URL params for banners |
| `app/(auth)/login/page.tsx` | Pass `searchParams` to `LoginForm` so it can display banners |
| `actions/auth.ts` | Add `requestPasswordReset(email)` and `updatePassword(password)` server actions |
| `lib/supabase/middleware.ts` | Add `/auth/callback` and `/update-password` to public route exceptions |

### Outside the Codebase

Supabase Dashboard → Authentication → Email Templates → Reset Password: set the redirect URL to `https://board.eastspringlake.com/auth/callback`. This covers both the self-service flow and resets sent manually from Supabase User Management.

---

## Component Design

### `LoginForm.tsx` — Inline Toggle

Three visual states managed by a single `mode` state variable:

- `"signin"` — current login form (default)
- `"forgot"` — email input + "Send reset link" button + back arrow
- `"sent"` — static "Check your email" message + back arrow

Banners (success/error from URL params) appear above the form in `"signin"` mode only.

### `UpdatePasswordForm.tsx`

Fields: New password, Confirm password.

Zod schema:
- Both fields: `string().min(8, "At least 8 characters")`
- Confirm must match New password via `.refine()`

On submit: calls `updatePassword` server action. Displays server-returned error if update fails (e.g., Supabase password policy rejection).

---

## Server Actions

### `requestPasswordReset(email: string): Promise<void>`

- Reads `origin` from `next/headers` to construct `redirectTo` dynamically (works in dev and prod).
- Always returns `void` — never reveals whether the email exists (prevents enumeration).
- Caller always shows "Check your email" regardless of outcome.

### `updatePassword(password: string): Promise<string | never>`

- Creates a server Supabase client (uses the session established by `/auth/callback`).
- Calls `supabase.auth.updateUser({ password })`.
- On error: returns error message string to the client.
- On success: calls `supabase.auth.signOut()`, then `redirect('/login?message=...')`.

---

## Middleware Changes

`lib/supabase/middleware.ts` — extend the public routes check:

```ts
const isAuthRoute =
  request.nextUrl.pathname.startsWith("/login") ||
  request.nextUrl.pathname.startsWith("/auth/callback") ||
  request.nextUrl.pathname.startsWith("/update-password");
```

`/auth/callback` must be public so an unauthenticated user arriving from the reset email can reach the route handler. `/update-password` is public as a safety measure — in practice the callback sets a session before redirecting there, but this prevents a middleware redirect race if cookies aren't propagated in time.

---

## Security Properties

- **PKCE token flow** — `verifyOtp()` verifies server-side; tokens are single-use and expire after 1 hour.
- **Session invalidated post-reset** — `signOut()` is called immediately after `updateUser()`.
- **No email enumeration** — `requestPasswordReset` always returns success; "Check your email" is unconditional.
- **Middleware-gated update page** — `/update-password` is accessible only to users with a valid session (the recovery session set by the callback).
- **Dynamic `redirectTo`** — uses the request `origin` header; Supabase's redirect URL allowlist enforces domain constraints.
- **Server actions only** — all Supabase auth calls are server-side; no tokens or keys are exposed to the client.
- **CSRF protection** — built into Next.js server actions.

---

## Testing

Co-located test files per project convention:

- `app/auth/callback/route.test.ts` — verifyOtp success (redirects to /update-password), verifyOtp failure (redirects to /login?error=...)
- `app/(auth)/update-password/UpdatePasswordForm.test.tsx` — renders fields, zod validation (short password, mismatched confirm), calls updatePassword on valid submit, displays server error
- `actions/auth.test.ts` — extend existing file; test requestPasswordReset calls resetPasswordForEmail with correct redirectTo, test updatePassword calls updateUser + signOut + redirect on success, returns error string on failure
