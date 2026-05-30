import { PageHeader } from "@/components/hoa/PageHeader";
import { EmptyState } from "@/components/hoa/EmptyState";

export const metadata = {
  title: "Interactive Map — HOA Board",
};

/**
 * Interactive neighborhood map page.
 * Will display an SVG map (stored in DB) with clickable lot polygons and a property data table.
 * Placeholder pending the map feature spec and property/resident data migration.
 */
export default function MapPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Interactive Map"
        subtitle="Neighborhood lots and property information"
      />
      <EmptyState
        title="Coming soon"
        description="The interactive neighborhood map is in development."
      />
    </div>
  );
}
