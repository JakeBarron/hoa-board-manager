"use client";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Short headline explaining that nothing is here */
  title: string;
  /** Optional longer explanation or instructions */
  description?: string;
  /** Optional icon element rendered above the title */
  icon?: React.ReactNode;
  /** Optional CTA button or link rendered below the description */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Placeholder displayed when a list or section has no content yet.
 * Keeps "no data" states consistent across all sections of the app.
 */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-center",
        className
      )}
    >
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
