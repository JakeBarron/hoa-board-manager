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
