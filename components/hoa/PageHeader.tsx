"use client";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Main page title displayed as an h1 */
  title: string;
  /** Optional subtitle displayed below the title */
  subtitle?: string;
  /** Optional action element (e.g. a Button) rendered flush right */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Consistent page-level heading used at the top of every route.
 * Renders a title, an optional subtitle, and an optional right-aligned action slot.
 */
export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
