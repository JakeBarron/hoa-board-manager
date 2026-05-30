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
