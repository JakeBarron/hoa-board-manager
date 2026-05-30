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
