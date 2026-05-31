import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmResetForm } from "./ConfirmResetForm";
import { confirmPasswordReset } from "@/actions/auth";

jest.mock("@/actions/auth", () => ({ confirmPasswordReset: jest.fn() }));
const mockConfirmPasswordReset = confirmPasswordReset as jest.MockedFunction<
  typeof confirmPasswordReset
>;

beforeEach(() => jest.clearAllMocks());

it("renders the confirm button", () => {
  render(<ConfirmResetForm tokenHash="tok123" type="recovery" />);
  expect(
    screen.getByRole("button", { name: /confirm password reset/i })
  ).toBeInTheDocument();
});

it("calls confirmPasswordReset with the correct token and type on click", async () => {
  mockConfirmPasswordReset.mockResolvedValue(undefined as never);
  render(<ConfirmResetForm tokenHash="tok123" type="recovery" />);
  await userEvent.click(
    screen.getByRole("button", { name: /confirm password reset/i })
  );
  await waitFor(() =>
    expect(mockConfirmPasswordReset).toHaveBeenCalledWith("tok123", "recovery")
  );
});

it("shows a server error when confirmPasswordReset returns an error message", async () => {
  mockConfirmPasswordReset.mockResolvedValue(
    "OTP has expired or already been used"
  );
  render(<ConfirmResetForm tokenHash="badtok" type="recovery" />);
  await userEvent.click(
    screen.getByRole("button", { name: /confirm password reset/i })
  );
  expect(
    await screen.findByText("OTP has expired or already been used")
  ).toBeInTheDocument();
});

it("shows a loading state while the action is pending", async () => {
  let resolve: (v: never) => void;
  mockConfirmPasswordReset.mockReturnValue(
    new Promise((res) => { resolve = res; })
  );
  render(<ConfirmResetForm tokenHash="tok123" type="recovery" />);
  await userEvent.click(
    screen.getByRole("button", { name: /confirm password reset/i })
  );
  expect(await screen.findByRole("button", { name: /verifying/i })).toBeDisabled();
  resolve!(undefined as never);
});
