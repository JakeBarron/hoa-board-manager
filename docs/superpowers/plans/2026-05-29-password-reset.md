# Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete password reset flow — "Forgot password?" inline toggle on the login card, Supabase token exchange callback, and a set-new-password page.

**Architecture:** A new `/auth/callback` route handler exchanges Supabase `token_hash` tokens for a session and redirects to `/update-password`. The update-password page (a new `(auth)` group page) calls `supabase.auth.updateUser()`, signs the user out, then redirects to `/login?message=...`. The login form gains an inline mode toggle for the forgot-password email form and reads URL params to show success/error banners.

**Tech Stack:** Next.js 16 App Router, `@supabase/ssr`, react-hook-form + zod, shadcn/ui v4, Jest + React Testing Library.

---

### Task 1: Middleware — allow callback and update-password routes

**Files:**
- Modify: `lib/supabase/middleware.ts`

- [ ] **Step 1: Open the file and extend `isAuthRoute`**

In `lib/supabase/middleware.ts`, replace:

```ts
const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
```

with:

```ts
const isAuthRoute =
  request.nextUrl.pathname.startsWith("/login") ||
  request.nextUrl.pathname.startsWith("/auth/callback") ||
  request.nextUrl.pathname.startsWith("/update-password");
```

- [ ] **Step 2: Run type-check to confirm no regressions**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/middleware.ts
git commit -m "feat: allow /auth/callback and /update-password as public routes"
```

---

### Task 2: Server actions — `requestPasswordReset` and `updatePassword`

**Files:**
- Modify: `actions/auth.ts`
- Create/extend: `actions/auth.test.ts`

- [ ] **Step 1: Write failing tests**

Create (or extend) `actions/auth.test.ts`:

```ts
import { requestPasswordReset, updatePassword } from "./auth";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

jest.mock("@/lib/supabase/server");
jest.mock("next/headers");
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

const mockResetPasswordForEmail = jest.fn();
const mockUpdateUser = jest.fn();
const mockSignOut = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (createClient as jest.Mock).mockResolvedValue({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
    },
  });
  (headers as jest.Mock).mockResolvedValue({
    get: jest.fn().mockReturnValue("http://localhost:3000"),
  });
});

describe("requestPasswordReset", () => {
  it("calls resetPasswordForEmail with the email and correct redirectTo", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    await requestPasswordReset("test@example.com");
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("test@example.com", {
      redirectTo: "http://localhost:3000/auth/callback",
    });
  });

  it("does not throw when Supabase returns an error", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: "User not found" } });
    await expect(requestPasswordReset("unknown@example.com")).resolves.toBeUndefined();
  });
});

describe("updatePassword", () => {
  it("calls updateUser then signOut then redirects on success", async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });

    await updatePassword("newpassword123");

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "newpassword123" });
    expect(mockSignOut).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      "/login?message=Password+updated.+Sign+in+with+your+new+password."
    );
  });

  it("returns an error string and does not sign out when updateUser fails", async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: "Password is too weak" } });

    const result = await updatePassword("weak");

    expect(result).toBe("Password is too weak");
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test actions/auth.test.ts --no-coverage
```

Expected: FAIL — `requestPasswordReset` and `updatePassword` are not exported.

- [ ] **Step 3: Implement the two new actions in `actions/auth.ts`**

Add these exports after the existing `signOut` function:

```ts
import { headers } from "next/headers";

/**
 * Sends a Supabase password reset email to the given address.
 * Always resolves — never reveals whether the email is registered.
 *
 * @param email - The address to send the reset link to
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "https://board.eastspringlake.com";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  });
}

/**
 * Updates the authenticated user's password, signs them out, and redirects to /login.
 * Called from the /update-password page after a successful token exchange.
 *
 * @param password - The new password
 * @returns An error message string if the update fails, otherwise redirects
 */
export async function updatePassword(password: string): Promise<string | never> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return error.message;
  await supabase.auth.signOut();
  redirect("/login?message=Password+updated.+Sign+in+with+your+new+password.");
}
```

Make sure `headers` is added to the import at the top of the file — `redirect` is already imported from `next/navigation`.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test actions/auth.test.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
pnpm test --no-coverage
```

Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add actions/auth.ts actions/auth.test.ts
git commit -m "feat: add requestPasswordReset and updatePassword server actions"
```

---

### Task 3: Auth callback route handler

**Files:**
- Create: `app/auth/callback/route.ts`
- Create: `app/auth/callback/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `app/auth/callback/route.test.ts`:

```ts
import { GET } from "./route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server");

const mockVerifyOtp = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (createClient as jest.Mock).mockResolvedValue({
    auth: { verifyOtp: mockVerifyOtp },
  });
});

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost:3000/auth/callback");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

it("redirects to /update-password when token is valid", async () => {
  mockVerifyOtp.mockResolvedValue({ error: null });
  const res = await GET(makeRequest({ token_hash: "validtoken", type: "recovery" }));
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("http://localhost:3000/update-password");
});

it("redirects to /login?error=... when token is invalid", async () => {
  mockVerifyOtp.mockResolvedValue({ error: { message: "Token expired" } });
  const res = await GET(makeRequest({ token_hash: "expiredtoken", type: "recovery" }));
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toContain("/login?error=");
});

it("redirects to /login?error=... when token_hash param is missing", async () => {
  const res = await GET(makeRequest({}));
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toContain("/login?error=");
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test app/auth/callback/route.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the route handler**

Create `app/auth/callback/route.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges a Supabase password-reset token for a session, then redirects.
 * Supabase sends the user here after they click a reset link in their email.
 *
 * On success: redirects to /update-password (session cookie is now set).
 * On failure: redirects to /login?error=... with a human-readable message.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}/update-password`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=Link+expired+or+invalid.+Please+request+a+new+one.`
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test app/auth/callback/route.test.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/auth/callback/route.ts app/auth/callback/route.test.ts
git commit -m "feat: add /auth/callback route handler for password reset token exchange"
```

---

### Task 4: UpdatePasswordForm component

**Files:**
- Create: `app/(auth)/update-password/UpdatePasswordForm.tsx`
- Create: `app/(auth)/update-password/UpdatePasswordForm.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `app/(auth)/update-password/UpdatePasswordForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdatePasswordForm } from "./UpdatePasswordForm";
import { updatePassword } from "@/actions/auth";

jest.mock("@/actions/auth", () => ({ updatePassword: jest.fn() }));
const mockUpdatePassword = updatePassword as jest.MockedFunction<typeof updatePassword>;

beforeEach(() => jest.clearAllMocks());

it("shows a validation error when the password is too short", async () => {
  render(<UpdatePasswordForm />);
  await userEvent.type(screen.getByLabelText("New password"), "short");
  await userEvent.type(screen.getByLabelText("Confirm password"), "short");
  await userEvent.click(screen.getByRole("button", { name: /update password/i }));
  expect(await screen.findByText("At least 8 characters")).toBeInTheDocument();
});

it("shows a validation error when passwords do not match", async () => {
  render(<UpdatePasswordForm />);
  await userEvent.type(screen.getByLabelText("New password"), "password123");
  await userEvent.type(screen.getByLabelText("Confirm password"), "different456");
  await userEvent.click(screen.getByRole("button", { name: /update password/i }));
  expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
});

it("calls updatePassword with the new password on valid submit", async () => {
  mockUpdatePassword.mockResolvedValue(undefined as never);
  render(<UpdatePasswordForm />);
  await userEvent.type(screen.getByLabelText("New password"), "newpassword123");
  await userEvent.type(screen.getByLabelText("Confirm password"), "newpassword123");
  await userEvent.click(screen.getByRole("button", { name: /update password/i }));
  await waitFor(() =>
    expect(mockUpdatePassword).toHaveBeenCalledWith("newpassword123")
  );
});

it("displays a server error when updatePassword returns an error message", async () => {
  mockUpdatePassword.mockResolvedValue("Password does not meet requirements");
  render(<UpdatePasswordForm />);
  await userEvent.type(screen.getByLabelText("New password"), "newpassword123");
  await userEvent.type(screen.getByLabelText("Confirm password"), "newpassword123");
  await userEvent.click(screen.getByRole("button", { name: /update password/i }));
  expect(
    await screen.findByText("Password does not meet requirements")
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test "app/\(auth\)/update-password/UpdatePasswordForm.test.tsx" --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `app/(auth)/update-password/UpdatePasswordForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { FormField } from "@/components/hoa/FormField";
import { updatePassword } from "@/actions/auth";

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

/**
 * Form for setting a new password after a successful reset-link token exchange.
 * Calls the updatePassword server action, which signs the user out and redirects to /login.
 */
export function UpdatePasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const error = await updatePassword(values.password);
    if (error) setServerError(error);
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Set New Password</CardTitle>
        <CardDescription>Choose a new password for your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            label="New password"
            htmlFor="password"
            error={errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
          </FormField>

          <FormField
            label="Confirm password"
            htmlFor="confirm"
            error={errors.confirm?.message}
          >
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              {...register("confirm")}
            />
          </FormField>

          {serverError && (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test "app/\(auth\)/update-password/UpdatePasswordForm.test.tsx" --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/update-password/UpdatePasswordForm.tsx" "app/(auth)/update-password/UpdatePasswordForm.test.tsx"
git commit -m "feat: add UpdatePasswordForm component"
```

---

### Task 5: Update password page shell

**Files:**
- Create: `app/(auth)/update-password/page.tsx`

No separate tests needed — this is a thin shell with no logic.

- [ ] **Step 1: Create the page**

Create `app/(auth)/update-password/page.tsx`:

```tsx
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const metadata = {
  title: "Set New Password — HOA Board",
};

/**
 * Password reset landing page — accessible after the /auth/callback token exchange.
 * Renders the UpdatePasswordForm centered on screen, matching the login page layout.
 */
export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <UpdatePasswordForm />
    </main>
  );
}
```

- [ ] **Step 2: Run type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/update-password/page.tsx"
git commit -m "feat: add /update-password page"
```

---

### Task 6: Login form — inline forgot-password toggle and URL param banners

**Files:**
- Modify: `app/(auth)/login/LoginForm.tsx`
- Create/extend: `app/(auth)/login/LoginForm.test.tsx`

- [ ] **Step 1: Write failing tests for the new behavior**

Create (or extend) `app/(auth)/login/LoginForm.test.tsx`. Add these tests — keep any existing tests already in the file:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";
import { signIn, requestPasswordReset } from "@/actions/auth";

jest.mock("@/actions/auth", () => ({
  signIn: jest.fn(),
  requestPasswordReset: jest.fn(),
}));
const mockSignIn = signIn as jest.MockedFunction<typeof signIn>;
const mockRequestPasswordReset = requestPasswordReset as jest.MockedFunction<
  typeof requestPasswordReset
>;

beforeEach(() => jest.clearAllMocks());

describe("LoginForm — forgot password", () => {
  it("shows the email form when 'Forgot password?' is clicked", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    expect(
      screen.getByRole("button", { name: /send reset link/i })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("calls requestPasswordReset and shows the sent confirmation", async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    await userEvent.type(screen.getByLabelText("Email"), "test@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() =>
      expect(mockRequestPasswordReset).toHaveBeenCalledWith("test@example.com")
    );
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it("returns to sign-in mode when back link is clicked from forgot mode", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    await userEvent.click(screen.getByRole("button", { name: /back to sign in/i }));
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });
});

describe("LoginForm — URL param banners", () => {
  it("shows a success banner when a message prop is provided", () => {
    render(<LoginForm message="Password updated. Sign in with your new password." />);
    expect(
      screen.getByText("Password updated. Sign in with your new password.")
    ).toBeInTheDocument();
  });

  it("shows an error banner when an error prop is provided", () => {
    render(<LoginForm error="Link expired or invalid. Please request a new one." />);
    expect(
      screen.getByText("Link expired or invalid. Please request a new one.")
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test "app/\(auth\)/login/LoginForm.test.tsx" --no-coverage
```

Expected: failures on the new tests (LoginForm doesn't accept props yet, no forgot mode).

- [ ] **Step 3: Rewrite `LoginForm.tsx` with the three-mode toggle**

Replace the entire contents of `app/(auth)/login/LoginForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { FormField } from "@/components/hoa/FormField";
import { signIn, requestPasswordReset } from "@/actions/auth";

type Mode = "signin" | "forgot" | "sent";

interface LoginFormProps {
  message?: string;
  error?: string;
}

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type LoginValues = z.infer<typeof loginSchema>;
type ForgotValues = z.infer<typeof forgotSchema>;

const headings: Record<Mode, { title: string; description: string }> = {
  signin: {
    title: "Board Sign In",
    description: "Sign in with your board position account",
  },
  forgot: {
    title: "Reset Password",
    description: "Enter your email to receive a reset link",
  },
  sent: {
    title: "Check Your Email",
    description: "A reset link has been sent if that address is registered",
  },
};

/**
 * Login card with three inline modes: sign-in, forgot-password, and post-send confirmation.
 * Accepts optional message/error props from URL search params to show post-reset banners.
 *
 * @param message - Success message from URL (e.g. after password update)
 * @param error - Error message from URL (e.g. expired reset link)
 */
export function LoginForm({ message, error }: LoginFormProps = {}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [serverError, setServerError] = useState<string | null>(null);

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const forgotForm = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });

  const onSignIn = async (values: LoginValues) => {
    setServerError(null);
    const err = await signIn(values.email, values.password);
    if (err) setServerError(err);
  };

  const onForgot = async (values: ForgotValues) => {
    await requestPasswordReset(values.email);
    setMode("sent");
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">{headings[mode].title}</CardTitle>
        <CardDescription>{headings[mode].description}</CardDescription>
      </CardHeader>
      <CardContent>
        {mode === "signin" && (
          <>
            {message && (
              <p role="status" className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">
                {message}
              </p>
            )}
            {(error || serverError) && (
              <p role="alert" className="mb-4 text-sm text-destructive">
                {error ?? serverError}
              </p>
            )}
            <form
              onSubmit={loginForm.handleSubmit(onSignIn)}
              className="space-y-4"
              noValidate
            >
              <FormField
                label="Email"
                htmlFor="email"
                error={loginForm.formState.errors.email?.message}
              >
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...loginForm.register("email")}
                />
              </FormField>

              <FormField
                label="Password"
                htmlFor="password"
                error={loginForm.formState.errors.password?.message}
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...loginForm.register("password")}
                />
              </FormField>

              <Button
                type="submit"
                className="w-full"
                disabled={loginForm.formState.isSubmitting}
              >
                {loginForm.formState.isSubmitting ? "Signing in…" : "Sign in"}
              </Button>

              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="w-full text-center text-sm text-muted-foreground hover:underline"
              >
                Forgot password?
              </button>
            </form>
          </>
        )}

        {mode === "forgot" && (
          <form
            onSubmit={forgotForm.handleSubmit(onForgot)}
            className="space-y-4"
            noValidate
          >
            <FormField
              label="Email"
              htmlFor="forgot-email"
              error={forgotForm.formState.errors.email?.message}
            >
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...forgotForm.register("email")}
              />
            </FormField>

            <Button
              type="submit"
              className="w-full"
              disabled={forgotForm.formState.isSubmitting}
            >
              {forgotForm.formState.isSubmitting ? "Sending…" : "Send reset link"}
            </Button>

            <button
              type="button"
              onClick={() => setMode("signin")}
              className="w-full text-center text-sm text-muted-foreground hover:underline"
            >
              ← Back to sign in
            </button>
          </form>
        )}

        {mode === "sent" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If that email is registered you&apos;ll receive a link shortly. Check your
              spam folder if it doesn&apos;t arrive within a few minutes.
            </p>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="w-full text-center text-sm text-muted-foreground hover:underline"
            >
              ← Back to sign in
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run the login form tests**

```bash
pnpm test "app/\(auth\)/login/LoginForm.test.tsx" --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/(auth)/login/LoginForm.tsx" "app/(auth)/login/LoginForm.test.tsx"
git commit -m "feat: add forgot-password inline toggle and URL param banners to LoginForm"
```

---

### Task 7: Login page — pass searchParams to LoginForm

**Files:**
- Modify: `app/(auth)/login/page.tsx`

No separate tests — this is a one-responsibility shell.

- [ ] **Step 1: Update the page to be async and forward URL params**

Replace `app/(auth)/login/page.tsx` with:

```tsx
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Sign In — HOA Board",
};

/**
 * Login page — public route, no auth required.
 * Forwards message/error URL params to LoginForm for post-reset banners.
 * searchParams is a Promise in Next.js 16 — must be awaited.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { message, error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <LoginForm message={message} error={error} />
    </main>
  );
}
```

- [ ] **Step 2: Type-check and full test suite**

```bash
pnpm type-check && pnpm test --no-coverage
```

Expected: no type errors, all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/login/page.tsx"
git commit -m "feat: forward message/error search params from login page to LoginForm"
```

---

### Task 8: Supabase dashboard configuration

This is a manual step — no code changes.

- [ ] **Step 1: Update the Reset Password email template redirect URL**

In the Supabase Dashboard:
1. Go to **Authentication → Email Templates → Reset Password**
2. Find the **"Redirect URL"** (or `{{ .RedirectTo }}` in the template)
3. Set it to: `https://board.eastspringlake.com/auth/callback`
4. Save.

This ensures both manually-sent resets (from Supabase User Management) and self-service resets (via the "Forgot password?" form) land on the `/auth/callback` route handler.

- [ ] **Step 2: Verify the redirect URL allowlist**

In **Authentication → URL Configuration**, confirm:
- Site URL: `https://board.eastspringlake.com`
- Redirect URLs includes: `https://board.eastspringlake.com/*`

No change should be needed — this was already configured — but confirm it covers `/auth/callback`.

---

## Manual Testing Checklist

After all tasks are complete, test locally with `pnpm dev`:

- [ ] Navigate to `/login` — "Forgot password?" link appears below the Sign in button
- [ ] Click "Forgot password?" — card swaps inline to the email form, no navigation
- [ ] Submit an email — card shows "Check Your Email" confirmation
- [ ] Click "← Back to sign in" — card returns to sign-in form
- [ ] Hit `/update-password` directly without a session — middleware redirects to `/login`
- [ ] Hit `/auth/callback` with no params — redirects to `/login?error=...`, error banner appears
- [ ] Trigger a real reset email (from Supabase dashboard) → click link → lands on `/update-password`
- [ ] Submit mismatched passwords — validation error shown, no submission
- [ ] Submit short password — validation error shown
- [ ] Submit valid new password — redirected to `/login?message=Password+updated...`, success banner shown
