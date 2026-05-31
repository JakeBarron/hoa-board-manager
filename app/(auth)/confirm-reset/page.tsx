import Link from "next/link";
import { type EmailOtpType } from "@supabase/supabase-js";
import { ConfirmResetForm } from "./ConfirmResetForm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export const metadata = {
  title: "Confirm Password Reset — HOA Board",
};

/**
 * Intermediate confirmation page for password reset email links.
 * Renders the token_hash from the URL without consuming it — the token
 * is only exchanged when the user explicitly clicks "Confirm".
 * This protects against email scanner pre-fetching consuming the one-time token.
 */
export default async function ConfirmResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash, type } = await searchParams;

  if (!token_hash || !type) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Link Invalid</CardTitle>
            <CardDescription>
              This reset link is missing required parameters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Request a new reset link
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <ConfirmResetForm tokenHash={token_hash} type={type as EmailOtpType} />
    </main>
  );
}
