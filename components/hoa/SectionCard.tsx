"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  /** Card section title */
  title: string;
  /** Optional description displayed below the title */
  description?: string;
  /** Card body content */
  children: React.ReactNode;
  /** Optional right-aligned element in the header (e.g. an action button) */
  headerAction?: React.ReactNode;
  className?: string;
}

/**
 * The primary card container used throughout the app.
 * Wraps shadcn's Card with a consistent header/body layout and an optional action slot.
 */
export function SectionCard({
  title,
  description,
  children,
  headerAction,
  className,
}: SectionCardProps) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description && (
            <CardDescription className="mt-0.5 text-sm">{description}</CardDescription>
          )}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
