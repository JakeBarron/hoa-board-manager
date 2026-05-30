import { requestPasswordReset, updatePassword } from "./auth";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

jest.mock("@/lib/supabase/server");
jest.mock("next/headers");
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

const mockResetPasswordForEmail = jest.fn();
const mockUpdateUser = jest.fn();
const mockSignOut = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (createClient as jest.Mock).mockResolvedValue({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
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
      redirectTo: "http://localhost:3000/auth/callback",
    });
  });

  it("does not throw when Supabase returns an error", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: "User not found" } });
    await expect(requestPasswordReset("unknown@example.com")).resolves.toBeUndefined();
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
