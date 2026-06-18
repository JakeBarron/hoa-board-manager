import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/hoa/SectionCard";

interface HomesideCardProps {
  contactName: string;
  phone: string;
  email: string;
  portalUrl: string;
}

/**
 * Presentational card for the Homeside management-company contact.
 * Renders name, click-to-call / click-to-email links, and a portal link.
 * Pure — receives pre-resolved setting values; does no data fetching, so it can
 * be reused on both the dashboard and the directory page.
 *
 * @param contactName - Homeside rep / contact name
 * @param phone       - Phone number (rendered as a tel: link)
 * @param email       - Email address (rendered as a mailto: link)
 * @param portalUrl   - Owner/management portal URL
 */
export function HomesideCard({ contactName, phone, email, portalUrl }: HomesideCardProps) {
  const hasAny = contactName || phone || email || portalUrl;

  return (
    <SectionCard title="Management Company (Homeside)">
      {hasAny ? (
        <div className="space-y-1.5 text-sm">
          {contactName && <p className="font-medium">{contactName}</p>}
          {phone && (
            <p>
              <a href={`tel:${phone}`} className="text-primary hover:underline">
                {phone}
              </a>
            </p>
          )}
          {email && (
            <p>
              <a href={`mailto:${email}`} className="text-primary hover:underline">
                {email}
              </a>
            </p>
          )}
          {portalUrl && (
            <div className="pt-1">
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={portalUrl} />}
              >
                Open portal
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Not set. The president can add Homeside contact info in Settings.
        </p>
      )}
    </SectionCard>
  );
}
