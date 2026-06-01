/**
 * Seed script — creates the 13 fixed position accounts in Supabase:
 * 8 board members (president, officers, members) + 5 committee chairs.
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
  { name: "president",   role: "president", email: "president@yourhoa.com", password: "ChangeMe123!" },
  // officers — can read and edit any section
  { name: "vp",          role: "officer",   email: "vp@yourhoa.com",           password: "ChangeMe123!" },
  { name: "secretary",   role: "officer",   email: "secretary@yourhoa.com",    password: "ChangeMe123!" },
  // members — read all, edit own section only
  { name: "treasurer",   role: "member",    email: "treasurer@yourhoa.com",    password: "ChangeMe123!" },
  { name: "pool",        role: "member",    email: "pool@yourhoa.com",         password: "ChangeMe123!" },
  { name: "membership",  role: "member",    email: "membership@yourhoa.com",   password: "ChangeMe123!" },
  { name: "tennis",      role: "member",    email: "tennis@yourhoa.com",       password: "ChangeMe123!" },
  { name: "social",      role: "member",    email: "social@yourhoa.com",       password: "ChangeMe123!" },
  // committee chairs — pre-meeting updates for their section only
  { name: "web",          role: "chair",    email: "web@yourhoa.com",          password: "ChangeMe123!" },
  { name: "architecture", role: "chair",    email: "architecture@yourhoa.com", password: "ChangeMe123!" },
  { name: "welcoming",    role: "chair",    email: "welcoming@yourhoa.com",    password: "ChangeMe123!" },
  { name: "clubhouse",    role: "chair",    email: "clubhouse@yourhoa.com",    password: "ChangeMe123!" },
  { name: "cra",          role: "chair",    email: "cra@yourhoa.com",          password: "ChangeMe123!" },
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

const FAKE_STREETS = [
  "Long Lake Drive",
  "Camp Point Court",
  "Spring Rock Court",
  "Stonebrook Court",
  "Lakeside Lane",
  "Crystal Ridge Way",
];

const FAKE_FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer",
  "Michael", "Linda", "William", "Barbara", "David", "Elizabeth",
  "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah",
  "Charles", "Karen",
];

const FAKE_LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia",
  "Miller", "Davis", "Wilson", "Anderson", "Taylor", "Thomas",
  "Jackson", "White", "Harris", "Martin", "Thompson", "Moore",
  "Young", "Allen", "King", "Wright", "Scott", "Green",
];

/** Lot numbers 1–193 with 11 gaps for realism (~182 lots). */
const SKIPPED_LOTS = new Set([15, 32, 47, 78, 99, 121, 145, 167, 181, 188, 192]);
const LOT_NUMBERS = Array.from({ length: 193 }, (_, i) => i + 1).filter(
  (n) => !SKIPPED_LOTS.has(n)
);

/**
 * Real membership categories and types. membership_type stores the short descriptor
 * (the portion after " - " in the full compound name). The "Non-Covenant" entry has
 * no sub-type so membership_type is null.
 */
const NON_MANDATORY_MEMBERSHIPS = [
  { membership: "Non-Mandatory",    membership_type: "Civic" },
  { membership: "Non-Mandatory",    membership_type: "Recreation Billable" },
  { membership: "Non-Covenant",     membership_type: "Non-Participating" },
  { membership: "Non-Mandatory",    membership_type: "Non Participating" },
  { membership: "Non-Covenant",     membership_type: "Civic" },
  { membership: "Non-ESL Resident", membership_type: "Recreation Billable" },
  { membership: "Non-Covenant",     membership_type: null },
];

/**
 * Builds ~182 deterministic fake property rows for the e2e Supabase project.
 * ~70% Mandatory/Recreation, ~30% spread evenly across the other 7 membership types.
 * Uses modular arithmetic so results are reproducible across runs.
 */
function buildFakeProperties() {
  return LOT_NUMBERS.map((lotNumber, i) => {
    const isMandatory = i % 10 < 7;
    const membership = isMandatory
      ? { membership: "Mandatory", membership_type: "Recreation" }
      : NON_MANDATORY_MEMBERSHIPS[Math.floor(i / 10) % NON_MANDATORY_MEMBERSHIPS.length];

    return {
      lot_number: lotNumber,
      first_name: FAKE_FIRST_NAMES[i % FAKE_FIRST_NAMES.length],
      last_name: FAKE_LAST_NAMES[i % FAKE_LAST_NAMES.length],
      account_number: `14${String(1000 + i).padStart(4, "0")}`,
      street_address: `${2600 + i} ${FAKE_STREETS[i % FAKE_STREETS.length]}`,
      membership: membership.membership,
      membership_type: membership.membership_type,
      annual_lease_fee: i % 18 === 0 ? 150.0 : null,
      email_1: i % 6 !== 0 ? `resident.${lotNumber}@example.com` : null,
      email_2: i % 12 === 1 ? `resident.${lotNumber}.alt@example.com` : null,
      key_fob_1: i % 8 !== 0 ? String(30000 + i * 2) : null,
      key_fob_2: i % 8 !== 0 ? String(30001 + i * 2) : null,
      sayor: i % 7 === 0,
    };
  });
}

/**
 * Upserts ~182 fake property rows into the e2e `properties` table.
 * Safe to re-run — uses upsert on lot_number.
 */
async function seedProperties(): Promise<void> {
  console.log("\nSeeding properties…");
  const properties = buildFakeProperties();
  const { error } = await supabase
    .from("properties")
    .upsert(properties, { onConflict: "lot_number" });

  if (error) throw new Error(`Failed to seed properties: ${error.message}`);
  console.log(`  ✓ Upserted ${properties.length} property rows`);
}

async function main() {
  console.log("Seeding board positions…\n");

  for (const pos of positions) {
    await seedPosition(pos);
  }

  // Fake property data is for e2e only. Guard behind an explicit opt-in so
  // running this script against prod doesn't pollute the real properties table.
  // Use import-properties-prod.ts to load real data into prod.
  if (process.env.SEED_FAKE_PROPERTIES === "true") {
    await seedProperties();
  } else {
    console.log("\nSkipping fake properties (set SEED_FAKE_PROPERTIES=true to include).");
  }

  console.log("\nDone. Remember to update emails and passwords before sharing.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
