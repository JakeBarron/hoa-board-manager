import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { SettingRow } from "@/components/hoa/SettingRow";
import { MeetingCadenceRow } from "@/components/hoa/MeetingCadenceRow";
import type { Setting } from "@/types/database";

export const metadata = { title: "Settings — HOA Board" };

/** Converts a snake_case key to a Title Case label. */
function keyToLabel(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Admin settings page — president only.
 * Displays all rows from the settings table as editable fields.
 * Adding a new configurable value only requires a DB row — no code change needed.
 */
export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: position } = await supabase
    .from("positions")
    .select("role")
    .eq("email", user.email!)
    .single();

  if (position?.role !== "president") redirect("/dashboard");

  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .order("key");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Configure HOA portal behaviour. Changes take effect immediately."
      />
      <SectionCard
        title="Configurable Values"
        description="Add new settings directly in the database — they appear here automatically."
      >
        <div className="divide-y divide-border">
          {(settings ?? []).map((s: Setting) =>
            s.key === "meeting_cadence" ? (
              <MeetingCadenceRow
                key={s.key}
                settingKey={s.key}
                description={s.description}
                initialValue={s.value}
              />
            ) : (
              <SettingRow
                key={s.key}
                settingKey={s.key}
                label={keyToLabel(s.key)}
                description={s.description}
                initialValue={s.value}
              />
            )
          )}
        </div>
      </SectionCard>
    </div>
  );
}
