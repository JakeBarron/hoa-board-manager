/**
 * @jest-environment node
 */
import { GET } from "./route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server");

const mockVerifyOtp = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (createClient as jest.Mock).mockResolvedValue({
    auth: { verifyOtp: mockVerifyOtp },
  });
});

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost:3000/auth/callback");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

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

it("redirects to /login?error=... when token_hash param is missing", async () => {
  const res = await GET(makeRequest({}));
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toContain("/login?error=");
});
