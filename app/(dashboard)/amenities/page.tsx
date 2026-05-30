import { PageHeader } from "@/components/hoa/PageHeader";
import { EmptyState } from "@/components/hoa/EmptyState";

export const metadata = {
  title: "Amenities — HOA Board",
};

/**
 * Amenities page. Will show Pool, Clubhouse, and Tennis widgets.
 * Placeholder pending amenity-specific feature specs.
 */
export default function AmenitiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Amenities"
        subtitle="Pool, Clubhouse, and Tennis"
      />
      <EmptyState
        title="Coming soon"
        description="Amenity management tools are being built."
      />
    </div>
  );
}
