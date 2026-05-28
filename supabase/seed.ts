/**
 * Seed script — creates the 7 fixed board position accounts in Supabase.
 *
 * Run once after applying the initial migration:
 *   npx tsx supabase/seed.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in your environment (not the anon key)
 * because creating users requires admin privileges.
 *
 * IMPORTANT: Change all passwords before sharing with board members.
 * This script uses placeholder emails — update them before running.
 */

import { createClient } from "@supabase/supabase-js";
import type { PositionName, PositionRole } from "../types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
  );
}

/** Admin client — bypasses RLS. Only for seeding. */
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Board position definitions to seed */
const positions: Array<{
  name: PositionName;
  role: PositionRole;
  email: string;
  password: string;
}> = [
  // president — full access + admin
  { name: "president",   role: "president", email: "president@yourhoa.com",   password: "ChangeMe123!" },
  // officers — can read and edit any section
  { name: "vp",          role: "officer",   email: "vp@yourhoa.com",           password: "ChangeMe123!" },
  { name: "secretary",   role: "officer",   email: "secretary@yourhoa.com",    password: "ChangeMe123!" },
  // members — read all, edit own section only
  { name: "treasurer",   role: "member",    email: "treasurer@yourhoa.com",    password: "ChangeMe123!" },
  { name: "pool",        role: "member",    email: "pool@yourhoa.com",         password: "ChangeMe123!" },
  { name: "membership",  role: "member",    email: "membership@yourhoa.com",   password: "ChangeMe123!" },
  { name: "tennis",      role: "member",    email: "tennis@yourhoa.com",       password: "ChangeMe123!" },
  { name: "social",      role: "member",    email: "social@yourhoa.com",       password: "ChangeMe123!" },
];

/**
 * Creates a Supabase Auth user and a corresponding positions row for a single position.
 * Skips creation if the email already exists.
 */
const seedPosition = async (pos: (typeof positions)[number]): Promise<void> => {
  // Create the Auth user
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: pos.email,
      password: pos.password,
      email_confirm: true,
    });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      console.log(`  ⟳ Auth user for ${pos.name} already exists`);
    } else {
      throw new Error(`Failed to create auth user for ${pos.name}: ${authError.message}`);
    }
  } else {
    console.log(`  ✓ Created auth user for ${pos.name}: ${authData.user?.id}`);
  }

  // Insert the positions row — independent of whether the auth user was just created
  const { error: dbError } = await supabase.from("positions").insert({
    name: pos.name,
    email: pos.email,
    role: pos.role,
  });

  if (dbError) {
    if (dbError.code === "23505") {
      console.log(`  ⟳ Position row for ${pos.name} already exists`);
      return;
    }
    throw new Error(`Failed to insert position row for ${pos.name}: ${dbError.message}`);
  }

  console.log(`  ✓ Inserted position row for ${pos.name}`);
};

async function main() {
  console.log("Seeding board positions…\n");

  for (const pos of positions) {
    await seedPosition(pos);
  }

  console.log("\nDone. Remember to update emails and passwords before sharing.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
