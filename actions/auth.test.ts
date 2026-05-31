import { requestPasswordReset, confirmPasswordReset, updatePassword } from "./auth";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

jest.mock("@/lib/supabase/server");
jest.mock("next/headers");
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

const mockResetPasswordForEmail = jest.fn();
const mockVerifyOtp = jest.fn();
const mockUpdateUser = jest.fn();
const mockSignOut = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (createClient as jest.Mock).mockResolvedValue({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
      verifyOtp: mockVerifyOtp,
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
      redirectTo: "http://localhost:3000/confirm-reset",
    });
  });

  it("does not throw when Supabase returns an error", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: "User not found" } });
    await expect(requestPasswordReset("unknown@example.com")).resolves.toBeUndefined();
  });
});

describe("confirmPasswordReset", () => {
  it("calls verifyOtp with token_hash and type, then redirects on success", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    await confirmPasswordReset("tok123", "recovery");
    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: "tok123", type: "recovery" });
    expect(redirect).toHaveBeenCalledWith("/update-password");
  });

  it("returns an error string and does not redirect when verifyOtp fails", async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: "OTP has expired or already been used" } });
    const result = await confirmPasswordReset("badtok", "recovery");
    expect(result).toBe("OTP has expired or already been used");
    expect(redirect).not.toHaveBeenCalled();
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
