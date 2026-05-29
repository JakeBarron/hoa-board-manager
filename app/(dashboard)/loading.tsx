import { Loader2 } from "lucide-react";

/**
 * Shown in the main content area while any dashboard page is fetching data.
 * The sidebar layout renders immediately; only the page content is suspended.
 */
export default function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-muted-foreground" size={32} />
    </div>
  );
}
