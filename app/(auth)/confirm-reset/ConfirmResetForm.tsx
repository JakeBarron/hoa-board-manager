"use client";

import { useState } from "react";
import Link from "next/link";
import { type EmailOtpType } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { confirmPasswordReset } from "@/actions/auth";

interface ConfirmResetFormProps {
  tokenHash: string;
  type: EmailOtpType;
}

/**
 * Confirmation step for password reset. Displays a single button; the reset
 * token is only consumed when the user explicitly clicks "Confirm".
 *
 * @param tokenHash - The token_hash from the reset email link
 * @param type - The OTP type ("recovery")
 */
export function ConfirmResetForm({ tokenHash, type }: ConfirmResetFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    const err = await confirmPasswordReset(tokenHash, type);
    if (err) {
      setError(err);
      setLoading(false);
    }
    // On success, confirmPasswordReset redirects — component unmounts
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Confirm Password Reset</CardTitle>
        <CardDescription>
          Click the button below to proceed with resetting your password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button className="w-full" onClick={handleConfirm} disabled={loading}>
          {loading ? "Verifying…" : "Confirm password reset"}
        </Button>
        <Link
          href="/login"
          className="block w-full text-center text-sm text-muted-foreground hover:underline"
        >
          ← Request a new reset link
        </Link>
      </CardContent>
    </Card>
  );
}
