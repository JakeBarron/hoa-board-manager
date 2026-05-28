import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Sign In — HOA Board",
};

/**
 * Login page — public route, no auth required.
 * Renders the client-side LoginForm component in a centered card.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <LoginForm />
    </main>
  );
}
