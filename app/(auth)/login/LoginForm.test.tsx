import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";
import { signIn, requestPasswordReset } from "@/actions/auth";

jest.mock("@/actions/auth", () => ({
  signIn: jest.fn(),
  requestPasswordReset: jest.fn(),
}));
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
