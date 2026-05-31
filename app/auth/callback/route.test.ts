/**
 * @jest-environment node
 */
import { GET } from "./route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server");

const mockVerifyOtp = jest.fn();
const mockExchangeCodeForSession = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (createClient as jest.Mock).mockResolvedValue({
    auth: { verifyOtp: mockVerifyOtp, exchangeCodeForSession: mockExchangeCodeForSession },
  });
});

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost:3000/auth/callback");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("token_hash flow (OTP)", () => {
  it("redirects to /update-password when token is valid", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    const res = await GET(makeRequest({ token_hash: "validtoken", type: "recovery" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/update-password");
  });

  it("redirects to /login?error=... when token is invalid", async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: "Token expired" } });
    const res = await GET(makeRequest({ token_hash: "expiredtoken", type: "recovery" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=");
  });
});

describe("code flow (PKCE)", () => {
  it("redirects to /update-password when code exchange succeeds", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(makeRequest({ code: "pkce-code-abc" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/update-password");
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("pkce-code-abc");
  });

  it("redirects to /login?error=... when code exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: { message: "Invalid code" } });
    const res = await GET(makeRequest({ code: "bad-code" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=");
  });

  it("does not call verifyOtp when code param is present", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    await GET(makeRequest({ code: "pkce-code", token_hash: "hash", type: "recovery" }));
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });
});

it("redirects to /login?error=... when no params are present", async () => {
  const res = await GET(makeRequest({}));
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toContain("/login?error=");
});
