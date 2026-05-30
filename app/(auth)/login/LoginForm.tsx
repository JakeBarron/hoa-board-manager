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
