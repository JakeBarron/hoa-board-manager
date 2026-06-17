import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { EmptyState } from "@/components/hoa/EmptyState";
import { HomesideCard } from "@/components/hoa/HomesideCard";
import { ContactRow } from "@/components/hoa/ContactRow";
import { ContactAddForm } from "@/components/hoa/ContactAddForm";
import { POSITION_LABELS } from "@/lib/positions";
import type { Contact, PositionName } from "@/types/database";

export const metadata = { title: "Directory — HOA Board" };

/** A single position row as shown in the read-only directory sections. */
type DirectoryPosition = {
  name: PositionName;
  display_name: string | null;
  email: string;
  phone: string | null;
};

/** Read-only person row for the Board / Chairs directory sections. */
function PersonRow({ position }: { position: DirectoryPosition }) {
  return (
    <div className="py-3">
      <p className="text-sm font-medium">
        {POSITION_LABELS[position.name]}
        {position.display_name ? (
          <span className="text-muted-foreground"> · {position.display_name}</span>
        ) : (
          <span className="text-muted-foreground italic"> · vacant</span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        <a href={`mailto:${position.email}`} className="text-primary hover:underline">
          {position.email}
        </a>
        {position.phone && (
          <>
            {" · "}
            <a href={`tel:${position.phone}`} className="text-primary hover:underline">
              {position.phone}
            </a>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Directory page — accessible to ALL authenticated users including chairs.
 * Shows the board roster (read-only, from positions), committee chairs,
 * collaborative committee contacts (editable by anyone), and the Homeside
 * management-company contact.
 */
export default async function DirectoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // NOTE: intentionally NO isChair redirect — the directory is for everyone.
  const [positionsResult, contactsResult, settingsResult] = await Promise.all([
    supabase.from("positions").select("name, display_name, email, phone").order("name"),
    supabase.from("contacts").select("*").order("category").order("sort_order"),
    supabase.from("settings").select("key, value"),
  ]);

  const allPositions = (positionsResult.data ?? []) as DirectoryPosition[];
  const contacts = (contactsResult.data ?? []) as Contact[];
  const settings = settingsResult.data ?? [];

  const CHAIR_NAMES: PositionName[] = [
    "web", "architecture", "welcoming", "clubhouse", "cra",
    "children_social", "newsletter", "social_media",
  ];
  const boardMembers = allPositions.filter((p) => !CHAIR_NAMES.includes(p.name));
  const committeeChairs = allPositions.filter((p) => CHAIR_NAMES.includes(p.name));

  const settingValue = (key: string) =>
    settings.find((s) => s.key === key)?.value ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Directory"
        subtitle="Board roster, committee contacts, and management company"
      />

      <SectionCard title="Board Members">
        <div className="divide-y divide-border">
          {boardMembers.map((p) => (
            <PersonRow key={p.name} position={p} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Committee Chairs">
        <div className="divide-y divide-border">
          {committeeChairs.map((p) => (
            <PersonRow key={p.name} position={p} />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Committee Contacts"
        description="Anyone can add or edit these — keep your section's contacts current."
        headerAction={<ContactAddForm />}
      >
        {contacts.length === 0 ? (
          <EmptyState title="No contacts yet" />
        ) : (
          <div className="divide-y divide-border">
            {contacts.map((c) => (
              <ContactRow key={c.id} contact={c} />
            ))}
          </div>
        )}
      </SectionCard>

      <HomesideCard
        contactName={settingValue("homeside_contact_name")}
        phone={settingValue("homeside_phone")}
        email={settingValue("homeside_email")}
        portalUrl={settingValue("homeside_portal_url")}
      />
    </div>
  );
}
